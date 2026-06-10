"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import PortfolioSummary from "@/components/PortfolioSummary";
import PortfolioChart from "@/components/PortfolioChart";
import TimeRangeSelector from "@/components/TimeRangeSelector";
import Watchlist from "@/components/Watchlist";
import PositionsList from "@/components/PositionsList";
import { usePortfolio } from "@/hooks/usePortfolio";
import { formatCurrency } from "@/lib/format";
import type { SummaryStats, TimeRange } from "@/types/portfolio";

export default function Page() {
  const [range, setRange] = useState<TimeRange>("1D");
  const [scrub, setScrub] = useState<number | null>(null);
  const { account, positions, news, loadingNews, history, loadingHistory, error } =
    usePortfolio(range);

  // Compute the value + change shown in the summary. When the user is
  // scrubbing, the value tracks the hovered point; otherwise it's the
  // end-of-period value (or live equity for 1D).
  const stats: SummaryStats = useMemo(() => {
    if (!history || history.points.length === 0) {
      const v = account?.equity ?? 0;
      return { value: v, changeAbs: 0, changePct: 0, isUp: true };
    }
    const base = history.baseValue;
    const idx = scrub ?? history.points.length - 1;
    const value =
      scrub == null && range === "1D" && account
        ? account.equity
        : history.points[idx].v;
    const changeAbs = value - base;
    const changePct = base ? changeAbs / base : 0;
    return { value, changeAbs, changePct, isUp: changeAbs >= 0 };
  }, [history, scrub, account, range]);

  const scrubLabel = useMemo(() => {
    if (scrub == null || !history) return null;
    const d = new Date(history.points[scrub].t);
    return range === "1D"
      ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [scrub, history, range]);

  return (
    <div className="min-h-screen bg-rh-bg">
      <Header />

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-8 pb-20 lg:grid-cols-[1fr_360px]">
        {/* Left: portfolio */}
        <div>
          <PortfolioSummary
            accountLabel="Individual"
            stats={stats}
            range={range}
            scrubLabel={scrubLabel}
          />

          <div className="mt-6">
            {history ? (
              <PortfolioChart history={history} onScrub={setScrub} up={stats.isUp} />
            ) : (
              <div className="h-[260px] animate-pulse rounded-lg bg-rh-surface" />
            )}
            {loadingHistory && history && (
              <div className="mt-1 h-0.5 w-full overflow-hidden rounded bg-rh-elevated">
                <div className="h-full w-1/3 animate-pulse bg-rh-green" />
              </div>
            )}
          </div>

          <div className="mt-4">
            <TimeRangeSelector value={range} onChange={setRange} isUp={stats.isUp} />
          </div>

          <div className="mt-6 flex items-center justify-between border-b border-rh-border pb-4">
            <div className="flex items-center gap-2 font-bold">
              Buying power
              <span className="grid h-4 w-4 place-items-center rounded-full border border-rh-muted text-[10px] text-rh-muted">
                i
              </span>
            </div>
            <span className="tnum font-medium">
              {account ? formatCurrency(account.buyingPower) : "—"}
            </span>
          </div>

          <div className="mt-6">
            <PositionsList positions={positions} loading={!positions} />
          </div>

          {error && (
            <p className="mt-6 rounded-lg bg-rh-red-dim px-4 py-3 text-sm text-rh-red">
              {error}
            </p>
          )}
        </div>

        {/* Right: nav + news */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-rh-elevated p-4">
            <Link
              href="/lessons"
              className="block w-full rounded-lg bg-rh-border px-4 py-3 text-center text-sm font-medium text-rh-text hover:bg-rh-elevated transition-colors border border-rh-border"
            >
              Technical Lessons
            </Link>
          </div>
          <Watchlist news={news} loading={loadingNews} />
        </div>
      </main>
    </div>
  );
}
