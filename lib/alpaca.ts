// Server-side Alpaca client. This file must only be imported from
// API route handlers (it reads secret env vars). If credentials are
// missing or USE_MOCK_DATA=true, every function falls back to mock data
// so the UI works immediately.
//
// Alpaca docs:
//   Account:           GET {trading}/v2/account
//   Positions:         GET {trading}/v2/positions
//   Portfolio history: GET {trading}/v2/account/portfolio/history
//   Latest bars/quotes:GET {data}/v2/stocks/bars  and  /v2/stocks/quotes/latest

import type {
  Account,
  PortfolioHistory,
  Position,
  TimeRange,
  Watchlist,
  WatchlistItem,
} from "@/types/portfolio";
import {
  mockAccount,
  mockPortfolioHistory,
  mockPositions,
  mockWatchlist,
} from "@/lib/mock";

const KEY = process.env.ALPACA_PAPER_KEY;
const SECRET = process.env.ALPACA_SECRET_KEY;
// Both env vars may include a /v2 suffix; strip it since all paths below start with /v2/.
const rawTrading = process.env.ALPACA_ENDPOINT ?? "https://paper-api.alpaca.markets/v2";
const TRADING = rawTrading.replace(/\/v2\/?$/, "");
const rawData = process.env.ALPACA_DATA_BASE_URL ?? "https://data.alpaca.markets/v2";
const DATA = rawData.replace(/\/v2\/?$/, "");

export function isMock(): boolean {
  return process.env.USE_MOCK_DATA === "true" || !KEY || !SECRET;
}

function headers(): HeadersInit {
  return {
    "APCA-API-KEY-ID": KEY ?? "",
    "APCA-API-SECRET-KEY": SECRET ?? "",
    accept: "application/json",
  };
}

async function get<T>(base: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(base + path);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Alpaca ${path} -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ---- Account -------------------------------------------------------------

export async function getAccount(): Promise<Account> {
  if (isMock()) return mockAccount();
  const a = await get<any>(TRADING, "/v2/account");
  return {
    equity: Number(a.equity),
    lastEquity: Number(a.last_equity),
    buyingPower: Number(a.buying_power),
    cash: Number(a.cash),
    currency: a.currency ?? "USD",
  };
}

// ---- Positions -----------------------------------------------------------

export async function getPositions(): Promise<Position[]> {
  if (isMock()) return mockPositions();
  const rows = await get<any[]>(TRADING, "/v2/positions");
  return rows.map((p) => ({
    symbol: p.symbol,
    qty: Number(p.qty),
    avgEntryPrice: Number(p.avg_entry_price),
    currentPrice: Number(p.current_price),
    marketValue: Number(p.market_value),
    unrealizedPl: Number(p.unrealized_pl),
    unrealizedPlpc: Number(p.unrealized_plpc),
  }));
}

// ---- Portfolio history ---------------------------------------------------

// Maps our UI ranges to Alpaca's (period, timeframe) parameters.
function rangeParams(range: TimeRange): { period?: string; timeframe: string; extended?: boolean } {
  switch (range) {
    case "1D": return { period: "1D", timeframe: "5Min", extended: true };
    case "1W": return { period: "1W", timeframe: "1H" };
    case "1M": return { period: "1M", timeframe: "1D" };
    case "3M": return { period: "3M", timeframe: "1D" };
    case "YTD": return { timeframe: "1D" }; // date_start computed below
    case "1Y": return { period: "1A", timeframe: "1D" };
    case "ALL": return { period: "all", timeframe: "1D" };
  }
}

export async function getPortfolioHistory(range: TimeRange): Promise<PortfolioHistory> {
  if (isMock()) return mockPortfolioHistory(range);

  const { period, timeframe, extended } = rangeParams(range);
  const params: Record<string, string> = { timeframe };
  if (period) params.period = period;
  if (extended) params.extended_hours = "true";
  if (range === "YTD") {
    params.date_start = `${new Date().getFullYear()}-01-01`;
  }

  const h = await get<{ timestamp: number[]; equity: (number | null)[]; base_value: number }>(
    TRADING,
    "/v2/account/portfolio/history",
    params
  );

  const points = h.timestamp
    .map((ts, i) => ({ t: ts * 1000, v: h.equity[i] }))
    .filter((p): p is { t: number; v: number } => p.v != null);

  return {
    range,
    points,
    baseValue: h.base_value ?? (points[0]?.v ?? 0),
  };
}

// ---- Stock bars (historical price chart) ---------------------------------

function stockBarsParams(range: TimeRange): { timeframe: string; start: string } {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
  switch (range) {
    case "1D":  return { timeframe: "5Min",  start: daysAgo(1) };
    case "1W":  return { timeframe: "1Hour", start: daysAgo(7) };
    case "1M":  return { timeframe: "1Day",  start: daysAgo(30) };
    case "3M":  return { timeframe: "1Day",  start: daysAgo(90) };
    case "YTD": return { timeframe: "1Day",  start: `${new Date().getFullYear()}-01-01` };
    case "1Y":  return { timeframe: "1Day",  start: daysAgo(365) };
    case "ALL": return { timeframe: "1Week", start: daysAgo(365 * 10) };
  }
}

export async function getStockBars(symbol: string, range: TimeRange): Promise<PortfolioHistory> {
  if (isMock()) {
    const n = 80;
    let v = 150 + Math.random() * 100;
    const points = Array.from({ length: n }, (_, i) => {
      v += (Math.random() - 0.48) * 3;
      return { t: Date.now() - (n - i) * 3600_000, v: Math.max(1, v) };
    });
    return { range, points, baseValue: points[0].v };
  }

  const { timeframe, start } = stockBarsParams(range);
  const data = await get<{ bars: Record<string, { t: string; c: number }[]> }>(
    DATA,
    "/v2/stocks/bars",
    { symbols: symbol, timeframe, start, adjustment: "split", limit: "10000" }
  );

  const bars = data.bars[symbol] ?? [];
  const points = bars.map((b) => ({ t: new Date(b.t).getTime(), v: b.c }));
  return { range, points, baseValue: points[0]?.v ?? 0 };
}

// ---- Watchlist (market data) ---------------------------------------------

export async function getWatchlist(): Promise<Watchlist> {
  if (isMock()) return mockWatchlist();
  console.log("Getting watchlist")
  // Fetch the user's Alpaca watchlists and pick the first one.
  const lists = await get<Array<{ id: string; name: string }>>(TRADING, "/v2/watchlists");
  if (!lists.length) return { name: "Watchlist", items: [] };

  const wl = await get<{ id: string; name: string; assets: Array<{ symbol: string }> }>(
    TRADING,
    `/v2/watchlists/${lists[0].id}`
  );
  const symbols = wl.assets.map((a) => a.symbol);
  console.log(symbols)
  if (!symbols.length) return { name: wl.name, items: [] };

  const symParam = symbols.join(",");

  // Latest bar per symbol for current price and open.
  const latest = await get<{ bars: Record<string, { c: number; o: number }> }>(
    DATA,
    "/v2/stocks/bars/latest",
    { symbols: symParam }
  );

  // 30 daily bars per symbol for the sparkline.
  const start = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const bars = await get<{ bars: Record<string, { c: number; o: number }[]> }>(
    DATA,
    "/v2/stocks/bars",
    { symbols: symParam, timeframe: "1Day", start, limit: "1500" }
  );

  const items: WatchlistItem[] = symbols.map((symbol) => {
    const series = (bars.bars[symbol] ?? []).slice(-30);
    const spark = series.map((b) => b.c);
    const price = latest.bars[symbol]?.c ?? spark[spark.length - 1] ?? 0;
    const open = latest.bars[symbol]?.o ?? series[series.length - 1]?.o ?? price;
    const changePct = open ? (price - open) / open : 0;
    return { symbol, price, changePct, spark };
  });

  return { name: wl.name, items };
}
