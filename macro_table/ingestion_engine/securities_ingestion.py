"""
Populate the securities table with current S&P 500 constituents.

Ticker convention: Wikipedia dotted form preserved (BRK.B, BF.B).
Multi-class shares (GOOGL/GOOG, FOX/FOXA, NWS/NWSA) are kept as separate rows.

Env var: NEON_DATABASE_URL  (read from .env or environment)
"""

import argparse
import io
import logging
import os
import sys
import time
from typing import Optional

import psycopg
import requests
import pandas as pd
import yfinance as yf
from dotenv import load_dotenv
from psycopg import Connection

load_dotenv()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CONN_STRING = os.getenv("NEON_DATABASE_URL")
DEFAULT_EXCHANGE = "NYSE"
SP500_WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
ENRICH_SLEEP_SECONDS = 0.3          # polite delay between yfinance calls
EXCHANGE_CODE_MAP = {
    "NMS": "NASDAQ",
    "NGM": "NASDAQ",
    "NCM": "NASDAQ",
    "NYQ": "NYSE",
    "ASE": "AMEX",
    "PCX": "NYSE",
    "BTS": "NYSE",
    "NYSEArca": "NYSE",
    "NASDAQ": "NASDAQ",
    "NYSE": "NYSE",
}

logging.basicConfig(
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    level=logging.INFO,
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Step 0 — inspect live DB constraints and reference tables
# ---------------------------------------------------------------------------

def inspect_db(conn: Connection) -> dict:
    """
    Print constraints on securities, industries rows, and current securities count.
    Returns a dict with 'unique_constraints', 'industries', 'securities_count'.
    Exits with a warning if a standalone UNIQUE(exchange) constraint is found.
    """
    with conn.cursor() as cur:
        # --- constraints on securities ---
        cur.execute("""
            SELECT
                tc.constraint_name,
                tc.constraint_type,
                string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema    = kcu.table_schema
               AND tc.table_name      = kcu.table_name
            WHERE tc.table_name   = 'securities'
              AND tc.table_schema = 'public'
              AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
            GROUP BY tc.constraint_name, tc.constraint_type
            ORDER BY tc.constraint_type, tc.constraint_name;
        """)
        constraints = cur.fetchall()

        log.info("=== securities constraints ===")
        for name, ctype, cols in constraints:
            log.info("  %-40s  %-12s  %s", name, ctype, cols)

        # --- check for standalone UNIQUE(exchange) ---
        solo_exchange = [
            (name, ctype, cols)
            for name, ctype, cols in constraints
            if ctype == "UNIQUE" and cols.strip() == "exchange"
        ]
        if solo_exchange:
            name = solo_exchange[0][0]
            log.error(
                "\nFATAL: A standalone UNIQUE constraint on 'exchange' exists:\n"
                "  Constraint name: %s\n\n"
                "This would allow only one security per exchange. Drop it first:\n\n"
                '  ALTER TABLE securities DROP CONSTRAINT "%s";\n\n'
                "Then re-run this script.",
                name, name,
            )
            sys.exit(1)

        # determine conflict target
        unique_single_ticker = any(
            ctype == "UNIQUE" and cols.strip() == "ticker"
            for _, ctype, cols in constraints
        )
        unique_composite = any(
            ctype == "UNIQUE" and set(c.strip() for c in cols.split(",")) == {"ticker", "exchange"}
            for _, ctype, cols in constraints
        )
        if unique_composite:
            conflict_target = "(ticker, exchange)"
        elif unique_single_ticker:
            conflict_target = "(ticker)"
        else:
            log.error(
                "Could not find UNIQUE(ticker,exchange) or UNIQUE(ticker) on securities. "
                "Inspect the table and try again."
            )
            sys.exit(1)

        log.info("Conflict target: %s", conflict_target)

        # --- industries ---
        cur.execute("SELECT id, code, name, parent_id FROM industries ORDER BY id;")
        industries = cur.fetchall()
        log.info("\n=== industries table ===")
        for row in industries:
            log.info("  id=%-4s  code=%-40s  name=%-40s  parent_id=%s", *row)

        # --- current securities count ---
        cur.execute("SELECT COUNT(*) FROM securities;")
        sec_count = cur.fetchone()[0]
        log.info("\nCurrent securities row count: %d\n", sec_count)

    return {
        "unique_constraints": constraints,
        "conflict_target": conflict_target,
        "industries": industries,          # list of (id, code, name, parent_id)
        "securities_count": sec_count,
    }


# ---------------------------------------------------------------------------
# Step 1 — fetch S&P 500 from Wikipedia
# ---------------------------------------------------------------------------

def fetch_sp500() -> pd.DataFrame:
    """
    Returns DataFrame with columns: ticker, name, gics_sector, gics_sub_industry.
    Tickers are in Wikipedia dotted form (BRK.B etc.).
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        )
    }
    log.info("Fetching S&P 500 list from Wikipedia …")
    resp = requests.get(SP500_WIKI_URL, headers=headers, timeout=20)
    resp.raise_for_status()

    # pandas >= 2.1 requires a file-like object, not a raw HTML string
    tables = pd.read_html(io.StringIO(resp.text))
    # First table is the constituent list
    df = tables[0]

    # Normalise column names (Wikipedia sometimes changes them)
    df.columns = [c.strip() for c in df.columns]
    col_map = {
        "Symbol": "ticker",
        "Security": "name",
        "GICS Sector": "gics_sector",
        "GICS Sub-Industry": "gics_sub_industry",
    }
    df = df.rename(columns=col_map)[["ticker", "name", "gics_sector", "gics_sub_industry"]]
    df["ticker"] = df["ticker"].str.strip()
    df["name"] = df["name"].str.strip()
    df = df.drop_duplicates(subset=["ticker"])
    log.info("Fetched %d S&P 500 constituents.", len(df))
    return df


# ---------------------------------------------------------------------------
# Step 2 — build GICS → industry_id mapping from live industries rows
# ---------------------------------------------------------------------------

def build_industry_map(
    industries: list,
    df: pd.DataFrame,
) -> tuple[dict, list]:
    """
    Returns:
      mapping  : { gics_key -> (industry_id, code, name) }
      unmapped : list of (gics_key, [tickers])

    'gics_key' is the value we match against — either sector or sub-industry
    depending on what the industries table contains.

    Strategy:
    1. Try to match GICS Sector to industries.name (case-insensitive, normalised).
    2. Fall back to matching GICS Sub-Industry to industries.name or code.
    3. Report anything that has no confident match — never silently assign NULL.
    """
    def _normalise(s: str) -> str:
        return s.lower().strip().replace("-", " ").replace("_", " ").replace("  ", " ")

    ind_by_name = {_normalise(r[2]): r for r in industries}
    ind_by_code = {_normalise(r[1]): r for r in industries}

    # collect distinct GICS keys
    distinct_sectors = df["gics_sector"].dropna().unique().tolist()

    mapping: dict[str, tuple] = {}    # gics_sector -> industry row
    unmapped_keys: dict[str, list] = {}

    for sector in distinct_sectors:
        key = _normalise(sector)
        if key in ind_by_name:
            mapping[sector] = ind_by_name[key]
        elif key in ind_by_code:
            mapping[sector] = ind_by_code[key]
        else:
            # try sub-industry fallback for tickers in this sector
            unmapped_keys[sector] = []

    # For sectors that didn't match, try sub-industry
    for _, row in df.iterrows():
        sector = row["gics_sector"]
        if sector in unmapped_keys:
            sub = row.get("gics_sub_industry", "")
            if pd.notna(sub):
                sub_key = _normalise(sub)
                if sub_key in ind_by_name:
                    mapping[sector] = ind_by_name[sub_key]
                elif sub_key in ind_by_code:
                    mapping[sector] = ind_by_code[sub_key]

    # finalize unmapped
    unmapped: list = []
    for sector in unmapped_keys:
        if sector not in mapping:
            tickers = df[df["gics_sector"] == sector]["ticker"].tolist()
            unmapped.append((sector, tickers))

    # Print mapping for review
    log.info("\n=== Proposed GICS Sector → industry mapping ===")
    for sector, ind_row in sorted(mapping.items()):
        log.info("  %-45s  →  id=%-4s  code=%s  name=%s", sector, ind_row[0], ind_row[1], ind_row[2])

    if unmapped:
        log.warning("\n=== UNMAPPED GICS sectors (will NOT be inserted) ===")
        for sector, tickers in unmapped:
            log.warning("  sector=%-45s  tickers=%s", sector, tickers[:5])
    else:
        log.info("All GICS sectors mapped successfully.\n")

    return mapping, unmapped


# ---------------------------------------------------------------------------
# Step 3 — exchange enrichment via yfinance
# ---------------------------------------------------------------------------

def enrich_exchange(ticker: str) -> Optional[str]:
    """
    Returns the human-readable exchange name for ticker, or None on failure.
    Wikipedia uses dotted tickers; yfinance expects hyphens for some (BRK-B).
    """
    yf_ticker = ticker.replace(".", "-")
    try:
        info = yf.Ticker(yf_ticker).info
        raw = info.get("exchange", "")
        return EXCHANGE_CODE_MAP.get(raw, raw) or None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Step 4 — upsert
# ---------------------------------------------------------------------------

def upsert_securities(
    rows: list[dict],
    conflict_target: str,
    dry_run: bool,
) -> dict:
    """
    rows: list of dicts with keys ticker, name, exchange, industry_id
    Returns stats dict.
    """
    if dry_run:
        log.info("[DRY RUN] Would upsert %d rows (no DB writes).", len(rows))
        return {"planned": len(rows), "inserted": 0, "updated": 0}

    sql = f"""
        INSERT INTO securities (ticker, name, exchange, currency, industry_id, is_active)
        VALUES (%s, %s, %s, 'USD', %s, true)
        ON CONFLICT {conflict_target}
        DO UPDATE SET
            name        = EXCLUDED.name,
            industry_id = EXCLUDED.industry_id,
            is_active   = true;
    """

    params = [
        (r["ticker"], r["name"], r["exchange"], r["industry_id"]) for r in rows
    ]

    # Open a FRESH connection right before writing. The slow Wikipedia fetch /
    # yfinance enrichment can run for a long time; Neon drops idle connections,
    # so any connection opened earlier would be dead by now ("server conn crashed?").
    with psycopg.connect(CONN_STRING) as conn:
        # Classify insert vs update by capturing existing keys before the upsert.
        with conn.cursor() as cur:
            cur.execute("SELECT ticker, exchange FROM securities;")
            existing = {(t, e) for t, e in cur.fetchall()}

        # Single batched, transactional upsert. execute_values equivalent in
        # psycopg v3 is executemany, which pipelines the rows efficiently.
        with conn.transaction():
            with conn.cursor() as cur:
                cur.executemany(sql, params)

    inserted = sum(
        1 for r in rows if (r["ticker"], r["exchange"]) not in existing
    )
    updated = len(rows) - inserted
    return {"inserted": inserted, "updated": updated}


# ---------------------------------------------------------------------------
# Step 5 — final report
# ---------------------------------------------------------------------------

def final_report(
    conn: Connection,
    df_sp500: pd.DataFrame,
    inserted: int,
    updated: int,
    skipped: list,
    unmapped: list,
) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM securities;")
        total = cur.fetchone()[0]

        sp500_tickers = set(df_sp500["ticker"].tolist())
        cur.execute("SELECT ticker FROM securities WHERE ticker = ANY(%s);", (list(sp500_tickers),))
        present = {r[0] for r in cur.fetchall()}

    missing = sp500_tickers - present

    log.info("\n" + "=" * 60)
    log.info("SUMMARY")
    log.info("  Rows inserted : %d", inserted)
    log.info("  Rows updated  : %d", updated)
    log.info("  Rows skipped  : %d", len(skipped))
    if skipped:
        for ticker, reason in skipped[:20]:
            log.info("    %-12s  %s", ticker, reason)
        if len(skipped) > 20:
            log.info("    … and %d more", len(skipped) - 20)

    if unmapped:
        log.warning("  Unmapped GICS sectors (not inserted):")
        for sector, tickers in unmapped:
            log.warning("    sector=%s  tickers=%s", sector, tickers[:5])

    if missing:
        log.warning("  S&P 500 tickers absent from securities after run: %s", sorted(missing))
    else:
        log.info("  All S&P 500 tickers present in securities.")

    log.info("  Total securities rows: %d", total)
    log.info("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Populate securities table with S&P 500 constituents."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run all lookups and print the plan without writing to the DB.",
    )
    parser.add_argument(
        "--no-enrich",
        action="store_true",
        help=f"Skip yfinance exchange lookups; use DEFAULT_EXCHANGE='{DEFAULT_EXCHANGE}' for all.",
    )
    args = parser.parse_args()

    if not CONN_STRING:
        log.error("NEON_DATABASE_URL is not set. Aborting.")
        sys.exit(1)

    # ---- Step 0 (short-lived read connection) ----
    with psycopg.connect(CONN_STRING) as conn:
        db_info = inspect_db(conn)
    industries = db_info["industries"]
    conflict_target = db_info["conflict_target"]

    # ---- Step 1 (no DB connection held during the slow network work) ----
    df_sp500 = fetch_sp500()

    # ---- Step 2 ----
    gics_map, unmapped = build_industry_map(industries, df_sp500)

    if not gics_map:
        log.error("No GICS sectors could be mapped to industries rows. Aborting.")
        sys.exit(1)

    # ---- Step 3 — build insert rows (yfinance enrichment, can take a while) ----
    rows_to_insert: list[dict] = []
    skipped: list[tuple[str, str]] = []

    unmapped_sectors = {sector for sector, _ in unmapped}

    total = len(df_sp500)
    for i, (_, stock) in enumerate(df_sp500.iterrows(), 1):
        ticker = stock["ticker"]
        sector = stock["gics_sector"]

        if sector in unmapped_sectors:
            skipped.append((ticker, f"no industry mapping for sector '{sector}'"))
            continue

        ind_row = gics_map[sector]
        industry_id = ind_row[0]

        # Exchange enrichment
        if args.no_enrich:
            exchange = DEFAULT_EXCHANGE
        else:
            log.info("  [%d/%d] enriching exchange for %s …", i, total, ticker)
            exchange = enrich_exchange(ticker) or DEFAULT_EXCHANGE
            time.sleep(ENRICH_SLEEP_SECONDS)

        rows_to_insert.append(
            {
                "ticker": ticker,
                "name": stock["name"],
                "exchange": exchange,
                "industry_id": industry_id,
            }
        )

    log.info(
        "\nPrepared %d rows to upsert, %d skipped.",
        len(rows_to_insert),
        len(skipped),
    )

    if args.dry_run:
        log.info("[DRY RUN] Proposed rows (first 10):")
        for r in rows_to_insert[:10]:
            log.info("  %s", r)
        with psycopg.connect(CONN_STRING) as conn:
            final_report(conn, df_sp500, 0, 0, skipped, unmapped)
        return

    # ---- Step 4 (opens its own fresh connection internally) ----
    stats = upsert_securities(rows_to_insert, conflict_target, dry_run=False)

    # ---- Step 5 (fresh read connection) ----
    with psycopg.connect(CONN_STRING) as conn:
        final_report(
            conn,
            df_sp500,
            stats["inserted"],
            stats["updated"],
            skipped,
            unmapped,
        )


if __name__ == "__main__":
    main()
