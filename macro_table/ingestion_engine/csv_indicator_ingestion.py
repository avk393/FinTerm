import csv
import os

import psycopg
from dotenv import load_dotenv

load_dotenv()

CSV_FILE = os.path.expanduser("~/Downloads/ICSA.csv")
INDICATOR_ID = 12
conn_string = os.getenv("NEON_DATABASE_URL")

try:
    with open(CSV_FILE, newline="") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        code = headers[1]

        raw_rows = list(reader)

    rows_to_insert = [
        (row["observation_date"], float(row[code]))
        for row in raw_rows
        if row[code] not in (".", "", None)
    ]

    if not rows_to_insert:
        print(f"No valid rows found in {CSV_FILE}")
        exit(0)

    with psycopg.connect(conn_string) as conn:
        print("Connection established")

        rows = [(INDICATOR_ID, date, value) for date, value in rows_to_insert]

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
        print(f"Inserted/updated {len(rows)} observations for '{code}'.")

except Exception as e:
    print("Error:")
    print(e)
