"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PortfolioChart from "@/components/PortfolioChart";
import TimeRangeSelector from "@/components/TimeRangeSelector";
import { useStockBars } from "@/hooks/useStockBars";
import { useIndicatorObservations } from "@/hooks/useIndicatorObservations";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { TimeRange } from "@/types/portfolio";
import MacroIndicators from "@/components/MacroIndicators";
import StockNews from "@/components/StockNews";
import KnowledgeBaseSignals from "@/components/KnowledgeBaseSignals";

type NewsTab = "news" | "signals";

function NewsTabs({ symbol }: { symbol: string }) {
  const [activeTab, setActiveTab] = useState<NewsTab>("news");

  return (
    <>
      <div className="mb-4 flex gap-4 border-b border-rh-border">
        <button
          onClick={() => setActiveTab("news")}
          className={`pb-2 text-sm font-semibold transition-colors ${
            activeTab === "news"
              ? "border-b-2 border-rh-text text-rh-text"
              : "text-rh-muted hover:text-rh-text"
          }`}
        >
          Stock News
        </button>
        <button
          onClick={() => setActiveTab("signals")}
          className={`pb-2 text-sm font-semibold transition-colors ${
            activeTab === "signals"
              ? "border-b-2 border-rh-text text-rh-text"
              : "text-rh-muted hover:text-rh-text"
          }`}
        >
          Knowledge Base Signals
        </button>
      </div>
      {activeTab === "news" ? (
        <StockNews symbol={symbol} />
      ) : (
        <KnowledgeBaseSignals ticker={symbol} />
      )}
    </>
  );
}

const GREEN = "#00c805";
const RED = "#ff5000";

interface Props {
  symbol: string;
}

export default function StockDetail({ symbol }: Props) {
  const [range, setRange] = useState<TimeRange>("1D");
  const [scrub, setScrub] = useState<number | null>(null);
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<number | null>(null);
  const [selectedIndicatorName, setSelectedIndicatorName] = useState<string | null>(null);

  const { history, loading } = useStockBars(symbol, range);
  const { points: overlayPoints } = useIndicatorObservations(selectedIndicatorId, range);

  const stats = useMemo(() => {
    if (!history || history.points.length === 0)
      return { price: null, changeAbs: 0, changePct: 0, isUp: true };
    const idx = scrub ?? history.points.length - 1;
    const price = history.points[idx].v;
    const changeAbs = price - history.baseValue;
    const changePct = history.baseValue ? changeAbs / history.baseValue : 0;
    return { price, changeAbs, changePct, isUp: changeAbs >= 0 };
  }, [history, scrub]);

  const color = stats.isUp ? GREEN : RED;

  function handleSelectIndicator(id: number, name: string) {
    if (selectedIndicatorId === id) {
      setSelectedIndicatorId(null);
      setSelectedIndicatorName(null);
    } else {
      setSelectedIndicatorId(id);
      setSelectedIndicatorName(name);
    }
  }

  return (
    <div className="min-h-screen bg-rh-bg">
      <header className="border-b border-rh-border px-8 py-4">
        <Link href="/" className="text-sm text-rh-muted hover:text-rh-text transition-colors">
          ← Back
        </Link>
        <div className="mt-2 flex items-baseline gap-4">
          <h1 className="text-2xl font-bold">{symbol}</h1>
          {stats.price != null && (
            <span className="tnum text-xl font-medium">{formatCurrency(stats.price)}</span>
          )}
          {stats.price != null && (
            <span className="tnum text-sm" style={{ color }}>
              {formatCurrency(stats.changeAbs, { sign: true })} (
              {formatPercent(stats.changePct, { sign: true })})
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-8 py-8 lg:grid-cols-[1fr_360px]">
        {/* Left column: chart + indicators */}
        <div className="flex flex-col gap-6">
          {/* Chart */}
          <section>
            {loading && !history && (
              <div className="h-[300px] animate-pulse rounded-xl bg-rh-surface" />
            )}
            {history && (
              <PortfolioChart
                history={history}
                onScrub={setScrub}
                up={stats.isUp}
                height={300}
                overlayPoints={overlayPoints}
                overlayLabel={selectedIndicatorName ?? undefined}
              />
            )}
            <div className="mt-4">
              <TimeRangeSelector value={range} onChange={setRange} isUp={stats.isUp} />
            </div>
          </section>

          {/* Macro Indicators */}
          <section className="rounded-xl border border-rh-border bg-rh-surface p-6 flex-1">
            <h2 className="mb-4 text-lg font-bold">Macro Indicators</h2>
            <MacroIndicators
              symbol={symbol}
              selectedIndicatorId={selectedIndicatorId}
              onSelectIndicator={handleSelectIndicator}
            />
          </section>
        </div>

        {/* Right column: news */}
        <section className="rounded-xl border border-rh-border bg-rh-surface p-6">
          <NewsTabs symbol={symbol} />
        </section>
      </main>
    </div>
  );
}
