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

To connect real Alpaca data:

```bash
cp .env.local.example .env.local
# fill in ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY
# leave ALPACA_TRADING_BASE_URL as the paper endpoint while developing
```

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

```
app/
  layout.tsx            root layout, fonts, dark theme
  page.tsx              dashboard composition + derived summary stats
  globals.css           Tailwind + scrollbar / tabular-num helpers
  api/                  account · positions · portfolio-history · watchlist
components/
  Header.tsx            top nav + search
  PortfolioSummary.tsx  big value + change (updates while scrubbing)
  PortfolioChart.tsx    SVG equity chart with pointer scrubbing + baseline
  TimeRangeSelector.tsx 1D/1W/.../ALL tabs
  Sparkline.tsx         tiny per-row watchlist chart
  Watchlist.tsx         right-hand list column
  PositionsList.tsx     holdings list
hooks/usePortfolio.ts   data fetching
lib/                    alpaca client · mock data · formatters
types/portfolio.ts      shared domain types
```

## Notable details

- **Scrubbing chart.** Hovering/touching the chart emits the nearest point
  index up to the page, which recomputes the displayed value, change, and
  timestamp — the same interaction Robinhood uses. The line past the cursor
  dims while scrubbing.
- **Single source of tone.** Whether the period is up or down is computed once
  in `page.tsx` and passed to the chart and the range tabs, so the chart color,
  the change number, and the active-tab color never disagree.
- **Tabular figures** (`.tnum`) keep prices from shifting horizontally as values
  change during a scrub.

## Customizing

- **Colors / theme:** `tailwind.config.ts` under `colors.rh`.
- **Default watchlist symbols:** `DEFAULT` array in `app/api/watchlist/route.ts`.
- **Font:** swap the `DM_Sans` import in `app/layout.tsx`.




We're building a stock-dashboard feature that shows, for any selected stock, which macroeconomic indicators are favorable or unfavorable for that stock's industry. The method is to store a correlation between each industry's price index and each macro indicator, then combine that relationship with the indicator's current direction to produce the favorable/unfavorable verdict — the guiding principle being that a correlation is the relationship, not the verdict (verdict = correlation sign × current indicator direction), and that correlations must be computed on returns/changes, not price levels, to avoid spurious trend correlation. It's built lean on PostgreSQL as the source of truth, intended to be served to a React app as a denormalized JSON snapshot on a CDN fetched on startup, with the matrix stored long/narrow (one row per industry-indicator pair, not a wide table). Granularity is GICS sector level for v1 because clean tradable indices (the SPDR sector ETFs) exist there. Deliberate simplifications versus a fuller design: no point-in-time vintaging (it's a live dashboard, not a backtest, so reloads just overwrite), and no separate matrix-version table (correlations are overwritten in place). Five tables exist across four migrations, currently seeded only with placeholder/illustrative data: (1) indicators — macro-series catalog (code = source series ID, name, source, unit, frequency, transform, norm_lookback_days), seeded with eight FRED series: DGS10, T10Y2Y, CPIAUCSL, DCOILWTICO, UMCSENT, DTWEXBGS, UNRATE, GOLDAMGBD228NLBM; (2) industries — GICS sectors (code, name, index_proxy = the ETF ticker it's correlated against, nullable parent_id for future finer nesting), seeded with all 11 sectors and their SPDR ETFs; (3) securities — stocks (ticker, name, exchange, currency, industry_id → industries), seeded with ~6 example stocks; (4) indicator_observations (indicator_id → indicators, observation_date, value, UNIQUE(indicator_id, observation_date)) plus its twin index_observations (industry_id → industries, observation_date, value) holding the ETF prices, split into two tables because one table can't cleanly key to two parents; and (5) correlations — the heart (industry_id, indicator_id, correlation with CHECK between −1 and 1, window_days, n_observations, computed_at, UNIQUE(industry_id, indicator_id)).
The pieces connect like this: a selected stock resolves to its industry through securities.industry_id; that industry row carries the index_proxy ETF whose price history lives in index_observations, while each macro indicator's history lives in indicator_observations; the correlations table joins industry × indicator. To render the dashboard you read all correlations for the selected stock's industry, combine each with that indicator's current direction (derived from recent observations) into a favorable/unfavorable label, and rank by absolute correlation. All seed inserts resolve foreign keys by looking up the parent's code via subqueries, and the observation and correlation tables use their UNIQUE constraints as ON CONFLICT DO UPDATE upsert targets so the ingestion and compute jobs can overwrite cleanly. Status: all schema tables (migrations 001–004) are built and seeded with placeholder data; nothing is populated with real data yet. Remaining work, not started: decide whether to cache verdicts in a small positions table or compute them live; build the ingestion job (FRED API for the macro series, a market-data API like Tiingo/Alpha Vantage/Polygon for ETF prices, since FRED has no ETF data); build the compute job that calculates rolling correlations on returns and upserts into correlations; and build the denormalized JSON snapshot plus CDN serving and the React startup fetch.