"use client";

import type { Watchlist as WatchlistType } from "@/types/portfolio";
import { formatCurrency, formatPercent } from "@/lib/format";
import Sparkline from "./Sparkline";

const GREEN = "#00c805";
const RED = "#ff5000";

interface Props {
  watchlist: WatchlistType | null;
  loading?: boolean;
}

export default function Watchlist({ watchlist, loading }: Props) {
  return (
    <aside className="self-start rounded-xl border border-rh-border bg-rh-bg">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="text-base font-bold">Watch List</h2>
      </div>

      <div className="rh-scroll max-h-[640px] overflow-y-auto">
        {loading && (
          <div className="space-y-3 px-4 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-rh-elevated" />
            ))}
          </div>
        )}

        {watchlist?.items.map((item) => {
          const up = item.changePct >= 0;
          const color = up ? GREEN : RED;
          return (
            <button
              key={item.symbol}
              className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-rh-border px-4 py-3 text-left transition-colors hover:bg-rh-elevated"
            >
              <span className="font-bold">{item.symbol}</span>
              <Sparkline data={item.spark} color={color} />
              <span className="text-right tnum">
                <span className="block font-medium">{formatCurrency(item.price)}</span>
                <span className="block text-sm" style={{ color }}>
                  {formatPercent(item.changePct, { sign: true })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
