import os

import matplotlib.pyplot as plt
import pandas as pd
import psycopg
from dotenv import load_dotenv

load_dotenv()

conn_string = os.getenv("NEON_DATABASE_URL")
index_id = 1
indicator_id = 1

try:
    with psycopg.connect(conn_string) as conn:
        print("Connection established")

        with conn.cursor() as cur:
            cur.execute(
                f"SELECT observation_date, value::float FROM index_observations WHERE industry_id={index_id} ORDER BY observation_date;"
            )
            index_rows = cur.fetchall()

            cur.execute(
                f"SELECT observation_date, value::float FROM indicator_observations WHERE indicator_id={indicator_id} ORDER BY observation_date;"
            )
            indicator_rows = cur.fetchall()

    # Build series
    idx_s = pd.Series(
        {pd.Timestamp(d): v for d, v in index_rows}, name="index"
    ).sort_index()
    ind_s = pd.Series(
        {pd.Timestamp(d): v for d, v in indicator_rows}, name="indicator"
    ).sort_index()

    # Resample to month-end
    idx_monthly = idx_s.resample("ME").last()
    ind_monthly = ind_s.resample("ME").last()

    # Index: percent change; indicator: absolute change
    idx_pct = idx_monthly.pct_change().dropna()
    ind_diff = ind_monthly.diff().dropna()

    # Align for correlation
    aligned_pct = pd.concat([idx_pct, ind_diff], axis=1, join="inner").dropna()
    aligned_pct.columns = ["index", "indicator"]

    r = aligned_pct["index"].corr(aligned_pct["indicator"])
    print(f"Pearson r = {r:.4f}  (n={len(aligned_pct)})")

    # Align raw values over the same date range for plotting
    aligned_raw = pd.concat([idx_monthly, ind_monthly], axis=1, join="inner").dropna()
    aligned_raw.columns = ["index", "indicator"]

    # Plot raw values
    fig, ax1 = plt.subplots(figsize=(12, 5))

    color_idx = "#2563eb"
    color_ind = "#dc2626"

    ax1.set_xlabel("Date")
    ax1.set_ylabel("Index", color=color_idx)
    ax1.plot(aligned_raw.index, aligned_raw["index"], color=color_idx, label="Index")
    ax1.tick_params(axis="y", labelcolor=color_idx)

    ax2 = ax1.twinx()
    ax2.set_ylabel("Indicator", color=color_ind)
    ax2.plot(aligned_raw.index, aligned_raw["indicator"], color=color_ind, alpha=0.75, label="Indicator")
    ax2.tick_params(axis="y", labelcolor=color_ind)

    fig.suptitle(
        f"Index {index_id} vs Indicator {indicator_id}  |  Pearson r = {r:.4f}",
        fontsize=13,
        fontweight="bold",
    )

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left")

    fig.tight_layout()
    plt.show()

except Exception as e:
    print("Error:")
    print(e)
