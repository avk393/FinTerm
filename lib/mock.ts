// Deterministic-ish mock data so the UI is fully functional before
// real Alpaca credentials are wired in. Everything here mirrors the
// shape returned by lib/alpaca.ts.

import type {
  Account,
  PortfolioHistory,
  Position,
  TimeRange,
  Watchlist,
  WatchlistItem,
} from "@/types/portfolio";

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Random-walk price series with a slight drift. */
function walk(seed: number, n: number, start: number, drift = 0): number[] {
  const rnd = seeded(seed);
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.5) * start * 0.012 + drift;
    out.push(Math.max(v, start * 0.5));
  }
  return out;
}

const RANGE_POINTS: Record<TimeRange, { n: number; spanMs: number }> = {
  "1D": { n: 78, spanMs: 6.5 * 60 * 60 * 1000 },
  "1W": { n: 7 * 26, spanMs: 7 * 24 * 60 * 60 * 1000 },
  "1M": { n: 30, spanMs: 30 * 24 * 60 * 60 * 1000 },
  "3M": { n: 90, spanMs: 90 * 24 * 60 * 60 * 1000 },
  YTD: { n: 150, spanMs: 150 * 24 * 60 * 60 * 1000 },
  "1Y": { n: 252, spanMs: 365 * 24 * 60 * 60 * 1000 },
  ALL: { n: 500, spanMs: 3 * 365 * 24 * 60 * 60 * 1000 },
};

export function mockPortfolioHistory(range: TimeRange): PortfolioHistory {
  const { n, spanMs } = RANGE_POINTS[range];
  const seed = range.length * 131 + n;
  const base = 24850;
  const series = walk(seed, n, base, range === "1D" ? 0 : base * 0.0008);
  const now = Date.now();
  let points = series.map((v, i) => ({
    t: now - spanMs + (spanMs / (n - 1)) * i,
    v: Math.round(v * 100) / 100,
  }));

  // For 1D, anchor the curve so it opens at the previous close and ends at
  // the live equity — this keeps the mock chart in agreement with the
  // account-based "Today" figure. (Real Alpaca data is naturally aligned.)
  if (range === "1D") {
    const acct = mockAccount();
    const first = points[0].v;
    const last = points[points.length - 1].v;
    points = points.map((p, i) => {
      const w = i / (points.length - 1);
      const target = acct.lastEquity + (acct.equity - acct.lastEquity) * w;
      const detrended = p.v - (first + (last - first) * w);
      return { t: p.t, v: Math.round((target + detrended) * 100) / 100 };
    });
    return { range, points, baseValue: acct.lastEquity };
  }

  return { range, points, baseValue: points[0].v };
}

export function mockAccount(): Account {
  return {
    equity: 24987.34,
    lastEquity: 24850.12,
    buyingPower: 5210.55,
    cash: 5210.55,
    currency: "USD",
  };
}

export function mockPositions(): Position[] {
  const raw = [
    { symbol: "SPY", name: "S&P 500 ETF", qty: 12, avg: 690.4, cur: 754.83 },
    { symbol: "SOXL", name: "Semiconductor Bull 3X", qty: 40, avg: 198.1, cur: 225.21 },
    { symbol: "MSOS", name: "US Cannabis ETF", qty: 300, avg: 4.9, cur: 5.09 },
    { symbol: "XLE", name: "Energy Select", qty: 25, avg: 58.0, cur: 56.72 },
  ];
  return raw.map((p) => {
    const marketValue = p.qty * p.cur;
    const cost = p.qty * p.avg;
    const unrealizedPl = marketValue - cost;
    return {
      symbol: p.symbol,
      name: p.name,
      qty: p.qty,
      avgEntryPrice: p.avg,
      currentPrice: p.cur,
      marketValue,
      unrealizedPl,
      unrealizedPlpc: unrealizedPl / cost,
    };
  });
}

export function mockWatchlist(): Watchlist {
  const defs: [string, number, number][] = [
    ["SPY", 754.83, 0.0058],
    ["MSOS", 5.09, 0.0946],
    ["XLE", 56.72, -0.0047],
    ["SRVR", 34.78, 0.0049],
    ["HOMZ", 44.11, -0.0037],
    ["SOXL", 225.21, 0.0332],
    ["VNM", 18.57, -0.0091],
    ["QQQ", 489.2, 0.0072],
  ];
  const items: WatchlistItem[] = defs.map(([symbol, price, changePct], i) => {
    const spark = walk(symbol.charCodeAt(0) + i * 7, 30, price, 0).map(
      (v) => Math.round(v * 100) / 100
    );
    return { symbol, price, changePct, spark };
  });
  return { name: "ETF", items };
}
