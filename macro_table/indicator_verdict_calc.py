"""
Compute per-indicator direction scores and write them to indicator_directions.
 
For each active indicator:
  1. pull its series from indicator_observations (filtered by indicator_id)
  2. resample to month-end, take a trailing CHANGE_MONTHS change
     (difference for rate/percent units, percent change for prices/indices)
  3. z-score the latest change against its own history over norm_lookback_days
     -> direction_raw
  4. blend in an indicator_views thesis if one exists -> direction
  5. upsert one row per indicator (current snapshot)
 
Usage:
    python compute_directions.py            # all active indicators
    python compute_directions.py 3          # only indicator_id = 3
"""
 
import os
import sys
import psycopg
import pandas as pd
from dotenv import load_dotenv
 
load_dotenv()
DATABASE_URL = os.environ["NEON_DATABASE_URL"]
 
CHANGE_MONTHS = 3  # horizon of the "recent move" the z-score measures
 
 
def table_exists(conn, name: str) -> bool:
    row = conn.execute(
        "SELECT to_regclass(%s) IS NOT NULL", (f"public.{name}",)
    ).fetchone()
    return bool(row[0])
 
 
def monthly_change(dates, values, unit: str) -> pd.Series:
    """Month-end resample, then a CHANGE_MONTHS-horizon change in the right units."""
    s = pd.Series([float(v) for v in values], index=pd.to_datetime(dates)).sort_index()
    monthly = s.resample("ME").last().dropna()
    if unit == "percent":  # yields / rates -> change in percentage points
        change = monthly.diff(CHANGE_MONTHS)
    else:  # prices / index levels -> percent change
        change = monthly.pct_change(periods=CHANGE_MONTHS, fill_method=None)
    return change.dropna()
 
 
def fetch_view(conn, indicator_id: int):
    """Returns (bias, weight) from indicator_views, or None."""
    return conn.execute(
        "SELECT bias, weight FROM indicator_views WHERE indicator_id = %s",
        (indicator_id,),
    ).fetchone()
 
 
def main() -> None:
    only_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
 
    with psycopg.connect(DATABASE_URL) as conn:
        has_views = table_exists(conn, "indicator_views")
 
        sql = "SELECT id, code, unit, norm_lookback_days FROM indicators WHERE is_active"
        params: tuple = ()
        if only_id is not None:
            sql += " AND id = %s"
            params = (only_id,)
        indicators = conn.execute(sql, params).fetchall()
 
        written = 0
        for ind_id, code, unit, lookback_days in indicators:
            rows = conn.execute(
                """SELECT observation_date, value
                   FROM indicator_observations
                   WHERE indicator_id = %s
                   ORDER BY observation_date""",
                (ind_id,),
            ).fetchall()
            if len(rows) < CHANGE_MONTHS + 2:
                print(f"{code}: not enough data, skipped")
                continue
 
            change = monthly_change([r[0] for r in rows], [r[1] for r in rows], unit)
            if change.empty:
                print(f"{code}: no change series, skipped")
                continue
 
            # z-score the latest move against the lookback window
            cutoff = change.index.max() - pd.Timedelta(days=int(lookback_days))
            window = change[change.index >= cutoff]
            mu = window.mean()
            sigma = window.std()
            latest = float(change.iloc[-1])
            direction_raw = (
                0.0 if (sigma == 0 or pd.isna(sigma)) else float((latest - mu) / sigma)
            )
 
            # blend in a thesis if indicator_views exists and has a row
            direction = direction_raw
            if has_views:
                view = fetch_view(conn, ind_id)
                if view is not None:
                    bias, weight = float(view[0]), float(view[1])
                    direction = (1 - weight) * direction_raw + weight * bias
 
            as_of = change.index.max().date()
            n_obs = int(len(window))
 
            conn.execute(
                """INSERT INTO indicator_directions
                       (indicator_id, direction, direction_raw, as_of_date,
                        change_months, n_observations)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (indicator_id) DO UPDATE SET
                       direction      = EXCLUDED.direction,
                       direction_raw  = EXCLUDED.direction_raw,
                       as_of_date     = EXCLUDED.as_of_date,
                       change_months  = EXCLUDED.change_months,
                       n_observations = EXCLUDED.n_observations,
                       computed_at    = now()""",
                (ind_id, direction, direction_raw, as_of, CHANGE_MONTHS, n_obs),
            )
            written += 1
            print(
                f"{code:18} dir={direction:+.2f} (raw {direction_raw:+.2f})  "
                f"as of {as_of}, n={n_obs}"
            )
 
        conn.commit()
        print(f"\nWrote {written} indicator direction(s).")
 
 
if __name__ == "__main__":
    main()
