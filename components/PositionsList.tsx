"use client";

import type { Position } from "@/types/portfolio";
import { formatCurrency, formatPercent, formatQty } from "@/lib/format";

const GREEN = "#00c805";
const RED = "#ff5000";

interface Props {
  positions: Position[] | null;
  loading?: boolean;
}

export default function PositionsList({ positions, loading }: Props) {
  return (
    <section className="border-t border-rh-border pt-6">
      <h2 className="mb-2 text-lg font-bold">Stocks</h2>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-rh-elevated" />
          ))}
        </div>
      )}

      {positions?.map((p) => {
        const up = p.unrealizedPlpc >= 0;
        const color = up ? GREEN : RED;
        return (
          <div
            key={p.symbol}
            className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-rh-border py-4"
          >
            <div>
              <div className="font-bold">{p.symbol}</div>
              <div className="text-sm text-rh-muted">
                {formatQty(p.qty)} shares · avg {formatCurrency(p.avgEntryPrice)}
              </div>
            </div>
            <div className="text-right tnum">
              <div className="font-medium">{formatCurrency(p.marketValue)}</div>
              <div className="text-sm" style={{ color }}>
                {formatCurrency(p.unrealizedPl, { sign: true })} (
                {formatPercent(p.unrealizedPlpc, { sign: true })})
              </div>
            </div>
          </div>
        );
      })}

      {positions && positions.length === 0 && !loading && (
        <p className="py-6 text-sm text-rh-muted">No open positions.</p>
      )}
    </section>
  );
}
