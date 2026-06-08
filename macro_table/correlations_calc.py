import os

import pandas as pd
import psycopg
from dotenv import load_dotenv

load_dotenv()

conn_string = os.getenv("NEON_DATABASE_URL")

WINDOW_MONTHS = 120
MIN_OBS = 24
WINDOW_DAYS = round(60 * 30.44)

try:
    with psycopg.connect(conn_string) as conn:
        print("Connection established")

        # Step 1: Load catalog
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, code, unit FROM indicators WHERE is_active = TRUE ORDER BY id;"
            )
            indicators = cur.fetchall()

            cur.execute(
                "SELECT id, index_proxy FROM industries WHERE index_proxy IS NOT NULL ORDER BY id;"
            )
            industries = cur.fetchall()

        print(f"Found {len(indicators)} active indicators, {len(industries)} industries with index proxies\n")

        # Step 2: Load all observations
        with conn.cursor() as cur:
            cur.execute(
                "SELECT indicator_id, observation_date, value::float FROM indicator_observations ORDER BY indicator_id, observation_date;"
            )
            ind_obs_rows = cur.fetchall()

            cur.execute(
                "SELECT industry_id, observation_date, value::float FROM index_observations ORDER BY industry_id, observation_date;"
            )
            idx_obs_rows = cur.fetchall()

        # Group rows into per-id pandas Series with DatetimeIndex
        if ind_obs_rows:
            ind_df = pd.DataFrame(ind_obs_rows, columns=["indicator_id", "date", "value"])
            ind_df["date"] = pd.to_datetime(ind_df["date"])
            ind_df = ind_df.set_index("date")
            ind_series = {
                iid: grp["value"].sort_index()
                for iid, grp in ind_df.groupby("indicator_id")
            }
        else:
            ind_series = {}

        if idx_obs_rows:
            idx_df = pd.DataFrame(idx_obs_rows, columns=["industry_id", "date", "value"])
            idx_df["date"] = pd.to_datetime(idx_df["date"])
            idx_df = idx_df.set_index("date")
            idx_series = {
                iid: grp["value"].sort_index()
                for iid, grp in idx_df.groupby("industry_id")
            }
        else:
            idx_series = {}

        # Step 3: Resample to month-end, last observation per month
        ind_monthly = {k: s.resample("ME").last() for k, s in ind_series.items()}
        idx_monthly = {k: s.resample("ME").last() for k, s in idx_series.items()}

        # Step 4: Convert to monthly changes
        # Industry index is always a price — percent change
        idx_changes = {k: s.pct_change() for k, s in idx_monthly.items()}

        # Indicator: diff() for rate/percent units, pct_change() otherwise
        ind_changes = {}
        for indicator_id, code, unit in indicators:
            if indicator_id not in ind_monthly:
                continue
            s = ind_monthly[indicator_id]
            ind_changes[indicator_id] = s.diff() if unit == "percent" else s.pct_change()

        # Steps 5-7: Pair, align, correlate, upsert
        rows_to_upsert = []
        skipped = 0

        for industry_id, index_proxy in industries:
            if industry_id not in idx_changes:
                skipped += len(indicators)
                continue
            idx_chg = idx_changes[industry_id]

            for indicator_id, code, unit in indicators:
                if indicator_id not in ind_changes:
                    skipped += 1
                    continue

                aligned = pd.concat(
                    [idx_chg, ind_changes[indicator_id]], axis=1, join="inner"
                ).dropna()
                aligned.columns = ["idx", "ind"]

                aligned = aligned.tail(WINDOW_MONTHS)

                if len(aligned) < MIN_OBS:
                    skipped += 1
                    continue

                corr = aligned["idx"].corr(aligned["ind"])
                if pd.isna(corr):
                    skipped += 1
                    continue

                corr = max(-1.0, min(1.0, corr))
                rows_to_upsert.append((industry_id, indicator_id, corr, WINDOW_DAYS, len(aligned)))
    
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO correlations (industry_id, indicator_id, correlation, window_days, n_observations)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (industry_id, indicator_id) DO UPDATE
                    SET correlation = EXCLUDED.correlation,
                        window_days = EXCLUDED.window_days,
                        n_observations = EXCLUDED.n_observations,
                        computed_at = now();
                """,
                rows_to_upsert,
            )

        conn.commit()
        print(f"Upserted {len(rows_to_upsert)} correlation pairs, skipped {skipped} pairs.")
        print("Done.")
        

except Exception as e:
    print("Error:")
    print(e)
