"use client";

import { useEffect, useState } from "react";
import type { AnalysisResult, AnalysisSignal } from "@/knowledge_table/analysis/engine";

interface Props {
  ticker: string;
}

const ALIGNMENT_STYLES: Record<AnalysisSignal["alignment"], { label: string; bg: string; text: string }> = {
  aligns:    { label: "Aligns",    bg: "bg-rh-green-dim",  text: "text-rh-green" },
  conflicts: { label: "Conflicts", bg: "bg-rh-red-dim",    text: "text-rh-red"   },
  neutral:   { label: "Neutral",   bg: "bg-rh-elevated",   text: "text-rh-muted" },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const color = pct >= 70 ? "#00c805" : pct >= 40 ? "#f5c518" : "#9b9b9b";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full bg-rh-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-rh-muted w-8 text-right">{pct}%</span>
    </div>
  );
}

function SignalCard({ signal }: { signal: AnalysisSignal }) {
  const style = ALIGNMENT_STYLES[signal.alignment];
  return (
    <div className="rounded-lg border border-rh-border bg-rh-elevated p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug flex-1">{signal.belief}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
      </div>
      <ConfidenceBar value={signal.confidence} />
      <p className="text-[11px] leading-relaxed text-rh-muted">{signal.reasoning}</p>
    </div>
  );
}

export default function KnowledgeBaseSignals({ ticker }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setResult(null);
    setError(null);

    fetch(`/api/analysis/${ticker}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<AnalysisResult>;
      })
      .then(setResult)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-3 w-3/4 animate-pulse rounded bg-rh-elevated" />
        <div className="h-3 w-full animate-pulse rounded bg-rh-elevated" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-rh-elevated" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-rh-muted">Failed to load analysis: {error}</p>;
  }

  if (!result) return null;

  if (!result.signals.length) {
    return <p className="text-sm text-rh-muted">{result.summary}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <p className="text-sm leading-relaxed text-rh-muted">{result.summary}</p>

      {/* Signal cards */}
      <div className="space-y-2">
        {result.signals.map((signal, i) => (
          <SignalCard key={i} signal={signal} />
        ))}
      </div>

      {/* Footer metadata */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-rh-muted">
          Generated {new Date(result.generatedAt).toLocaleString()}
        </span>
        {result.cached && (
          <span className="rounded-full bg-rh-elevated px-2 py-0.5 text-[10px] text-rh-muted">
            cached
          </span>
        )}
      </div>
    </div>
  );
}
