# Portfolio — Robinhood-style dashboard (Next.js + Alpaca)

A portfolio dashboard styled after Robinhood, built with **Next.js (App Router)**,
**React**, **TypeScript**, and **Tailwind CSS**. Data comes from **Alpaca**, with a
mock-data fallback so the UI works the moment you `npm run dev` — no keys required.

## Quick start

```bash
npm install
npm run dev        # runs entirely on mock data
# open http://localhost:3000
```

## Overview



## Setup
To connect app to backend data sources, export the following variables to your environment:
ALPACA_ENDPOINT
ALPACA_DATA_BASE_URL
ALPACA_PAPER_KEY
ALPACA_SECRET_KEY
ANTHROPIC_API_KEY
NEON_DATABASE_URL
FRED_API_KEY

Use the tables_schema.html to setup your own DB, and run the following python files to populate your tables:


Set `USE_MOCK_DATA=true` to force mock data even when keys are present.

## How it's wired
```
Browser (client components)
  └─ hooks/usePortfolio.ts        fetches from /api/* on the same origin
        └─ app/api/*/route.ts     server-only route handlers
              └─ lib/alpaca.ts    talks to Alpaca; secrets never reach the client
                    └─ lib/mock.ts  fallback when keys are missing / USE_MOCK_DATA
```

Your API keys should be exported as environment variables — the browser only ever calls your own
`/api/*` routes, never Alpaca directly. That's the reason for the route-handler
layer rather than calling Alpaca from the client.

### Alpaca endpoints used (`lib/alpaca.ts`)

| Feature            | Endpoint                                   |
| ------------------ | ------------------------------------------ |
| Account value / buying power | `GET /v2/account`                |
| Holdings           | `GET /v2/positions`                        |
| Equity curve (chart) | `GET /v2/account/portfolio/history`      |
| Watchlist prices / sparklines | `GET /v2/stocks/bars` (+ `/bars/latest`) |

The UI time ranges (`1D`/`1W`/`1M`/`3M`/`YTD`/`1Y`/`ALL`) map to Alpaca's
`period` + `timeframe` parameters in `rangeParams()`.

## Project layout

## Notable details


## Customizing

- **Colors / theme:** `tailwind.config.ts` under `colors.rh`.
- **Default watchlist symbols:** `DEFAULT` array in `app/api/watchlist/route.ts`.
- **Font:** swap the `DM_Sans` import in `app/layout.tsx`.

## Features

### Thesis Framework -> Knowledge Base Table
### Macro Indicator Tables

Future Features
Volatility Analysis
Be able to search for stocks matching thesis