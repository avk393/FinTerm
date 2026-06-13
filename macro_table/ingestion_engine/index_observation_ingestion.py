import os
from datetime import datetime, timedelta

import psycopg
import yfinance as yf
from dotenv import load_dotenv

load_dotenv()

conn_string = os.getenv("NEON_DATABASE_URL")

""""
try:
    with psycopg.connect(conn_string) as conn:
        print("Connection established")
        with conn.cursor() as cur:
            # Fetch all rows from the books table
            cur.execute("SELECT * FROM industries ORDER BY code;")
            rows = cur.fetchall()

            print("--------------------\n")
            for row in rows:
                print(
                    f"ID: {row[0]}, Code: {row[1]}, Name: {row[2]}, Index: {row[3]}"
                )
            print("--------------------\n")

except Exception as e:
    print("Connection failed.")
    print(e)


try:
    with psycopg.connect(conn_string) as conn:
        print("Connection established")

        # Open a cursor to perform database operations
        with conn.cursor() as cur:
            # Insert a single book record
            cur.execute(
                "INSERT INTO index_observations (industry_id, observation_date, value) VALUES (%s, %s, %s);",
                (4, '2025-06-01', 4.41),
            )
            print("Inserted a single index.")
except Exception as e:
    print("Connection failed.")
    print(e)
"""

end_date = datetime.today()
start_date = end_date - timedelta(days=365 * 10)

try:
    with psycopg.connect(conn_string) as conn:
        print("Connection established")

        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, code, name, index_proxy FROM industries WHERE index_proxy IS NOT NULL ORDER BY code;"
            )
            industries = cur.fetchall()

        print(f"Found {len(industries)} industries with index proxies\n")


        for industry_id, code, name, ticker in industries:
            print(f"Processing {name} ({code}) — ticker: {ticker}")

            data = yf.download(
                ticker,
                start=start_date.strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d"),
                auto_adjust=True,
                progress=False,
            )

            if data.empty:
                print(f"  No data returned for {ticker}, skipping.\n")
                continue

            rows = [
                (industry_id, date.date(), float(close))
                for date, close in zip(data.index, data["Close"].squeeze())
            ]

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO index_observations (industry_id, observation_date, value)
                    VALUES (%s, %s, %s)
                    ON CONFLICT ON CONSTRAINT index_observations_industry_id_observation_date_key
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
