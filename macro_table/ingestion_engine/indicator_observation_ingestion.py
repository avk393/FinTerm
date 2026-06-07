import os
import time
from datetime import datetime, timedelta

import psycopg
import requests
from dotenv import load_dotenv

load_dotenv()

conn_string = os.getenv("NEON_DATABASE_URL")
fred_api_key = os.getenv("FRED_API_KEY")

end_date = datetime.today()
start_date = end_date - timedelta(days=365 * 10)

try:
    with psycopg.connect(conn_string) as conn:
        print("Connection established")

        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, code FROM indicators WHERE is_active = TRUE ORDER BY code;"
            )
            indicators = cur.fetchall()

        print(f"Found {len(indicators)} active indicators\n")

        for indicator_id, code in indicators:
            print(f"Processing indicator {code} (id={indicator_id})")

            """
            if indicator_id in (1, 3, 4, 6):
                continue
            """
            
            for attempt in range(5):
                response = requests.get(
                    "https://api.stlouisfed.org/fred/series/observations",
                    params={
                        "series_id": code,
                        "api_key": fred_api_key,
                        "observation_start": start_date.strftime("%Y-%m-%d"),
                        "observation_end": end_date.strftime("%Y-%m-%d"),
                        "file_type": "json",
                    },
                )
                if response.status_code == 400:
                    wait = 2 ** attempt
                    print(f"  Rate limited on attempt {attempt + 1}, retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                response.raise_for_status()
                break
            else:
                print(f"  Failed after 5 attempts for {code}, skipping.\n")
                continue

            time.sleep(0.5)
            observations = response.json().get("observations", [])

            rows = [
                (indicator_id, obs["date"], float(obs["value"]))
                for obs in observations
                if obs["value"] != "."
            ]

            if not rows:
                print(f"  No data returned for {code}, skipping.\n")
                continue

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO indicator_observations (indicator_id, observation_date, value)
                    VALUES (%s, %s, %s)
                    ON CONFLICT ON CONSTRAINT indicator_observations_indicator_id_observation_date_key
                    DO UPDATE SET value = EXCLUDED.value;
                    """,
                    rows,
                )

            conn.commit()
            print(f"  Inserted/updated {len(rows)} observations.\n")

        print("Done.")

except Exception as e:
    print("Error:")
    print(e)
