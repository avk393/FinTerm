// Domain types for the portfolio dashboard.
// These are framework-agnostic and shared between the Alpaca client,
// API routes, and React components.

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

/** A single point on the portfolio equity curve. */
export interface EquityPoint {
  /** Unix epoch in milliseconds. */
  t: number;
  /** Account equity (total value) at that time. */
  v: number;
}

export interface PortfolioHistory {
  range: TimeRange;
  points: EquityPoint[];
  /** Equity at the start of the range, used as the dashed baseline. */
  baseValue: number;
}

export interface Account {
  /** Total current portfolio value. */
  equity: number;
  /** Equity at the previous close — used to compute "Today" change. */
  lastEquity: number;
  buyingPower: number;
  cash: number;
  currency: string;
}

export interface Position {
  symbol: string;
  name?: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  /** Unrealized P/L in dollars (total). */
  unrealizedPl: number;
  /** Unrealized P/L as a fraction, e.g. 0.0312 for +3.12%. */
  unrealizedPlpc: number;
}

export interface WatchlistItem {
  symbol: string;
  price: number;
  /** Day change as a fraction, e.g. -0.0047 for -0.47%. */
  changePct: number;
  /** Recent closes for the sparkline (oldest -> newest). */
  spark: number[];
}

export interface Watchlist {
  name: string;
  items: WatchlistItem[];
}

/** Derived value shown in the summary, recomputed as the chart is scrubbed. */
export interface SummaryStats {
  value: number;
  changeAbs: number;
  changePct: number;
  isUp: boolean;
}
