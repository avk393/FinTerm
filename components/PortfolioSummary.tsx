"use client";

import type { SummaryStats, TimeRange } from "@/types/portfolio";
import { formatCurrency, formatPercent } from "@/lib/format";

const RANGE_LABEL: Record<TimeRange, string> = {
  "1D": "Today",
  "1W": "Past Week",
  "1M": "Past Month",
  "3M": "Past 3 Months",
  YTD: "Year to Date",
  "1Y": "Past Year",
  ALL: "All Time",
};

interface Props {
  accountLabel: string;
  stats: SummaryStats;
  range: TimeRange;
  /** Timestamp shown when scrubbing the chart. */
  scrubLabel?: string | null;
}

export default function PortfolioSummary({ accountLabel, stats, range, scrubLabel }: Props) {
  const tone = stats.isUp ? "text-rh-green" : "text-rh-red";
  const arrow = stats.isUp ? "▲" : "▼";

  return (
    <div>
      <div className="flex items-center gap-2 text-rh-muted">
        <span className="text-base font-medium text-rh-text">{accountLabel}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-rh-muted">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="mt-2 text-hero font-bold tnum">{formatCurrency(stats.value)}</div>

      <div className="mt-1 flex items-center gap-2 text-lg font-medium tnum">
        <span className={tone}>
          {arrow} {formatCurrency(Math.abs(stats.changeAbs))} ({formatPercent(stats.changePct)})
        </span>
        <span className="text-rh-muted">{scrubLabel ?? RANGE_LABEL[range]}</span>
      </div>
    </div>
  );
}
