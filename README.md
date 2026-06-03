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

Your API keys stay on the server — the browser only ever calls your own
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

## Next steps you might want

- Multiple named watchlists (Alpaca has a watchlists API).
- Auto-refresh / websocket streaming for live prices.
- Per-symbol detail page reusing `PortfolioChart`.
- Auth, if this becomes multi-user.
