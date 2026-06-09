"use client";

import { useMacroIndicators } from "@/hooks/useMacroIndicators";

export type MacroSignal = "strong-bearish" | "bearish" | "neutral" | "bullish" | "strong-bullish";

export interface MacroIndicator {
  id: number;
  name: string;
  signal: MacroSignal;
  correlation: number;
  direction: number;
}

const SIGNAL_CONFIG: Record<
  MacroSignal,
  { arrows: string; color: string; bg: string; text: string }
> = {
  "strong-bearish": {
    arrows: "↓↓",
    color: "#ff5000",
    bg: "rgba(255,80,0,0.12)",
    text: "Strongly Bearish",
  },
  bearish: {
    arrows: "↓",
    color: "#ff8c69",
    bg: "rgba(255,140,105,0.10)",
    text: "Bearish",
  },
  neutral: {
    arrows: "→",
    color: "#8a9099",
    bg: "rgba(138,144,153,0.10)",
    text: "Neutral",
  },
  bullish: {
    arrows: "↑",
    color: "#7ecf8e",
    bg: "rgba(126,207,142,0.10)",
    text: "Bullish",
  },
  "strong-bullish": {
    arrows: "↑↑",
    color: "#00c805",
    bg: "rgba(0,200,5,0.12)",
    text: "Strongly Bullish",
  },
};

const OVERLAY_COLOR = "#818cf8";

interface Props {
  symbol: string;
  selectedIndicatorId?: number | null;
  onSelectIndicator?: (id: number, name: string) => void;
}

export default function MacroIndicators({
  symbol,
  selectedIndicatorId,
  onSelectIndicator,
}: Props) {
  const { indicators, loading, error } = useMacroIndicators(symbol);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[52px] animate-pulse rounded-lg bg-rh-border"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-rh-muted">Unable to load indicators.</p>;
  }

  if (!indicators || indicators.length === 0) {
    return <p className="text-sm text-rh-muted">No indicators found for this security.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {onSelectIndicator && (
        <p className="text-xs text-rh-muted mb-1">Click an indicator to overlay it on the chart</p>
      )}
      {indicators.map((indicator) => {
        const cfg = SIGNAL_CONFIG[indicator.signal];
        const isSelected = selectedIndicatorId === indicator.id;

        return (
          <div
            key={indicator.name}
            onClick={() => onSelectIndicator?.(indicator.id, indicator.name)}
            className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors"
            style={{
              background: isSelected
                ? "rgba(129,140,248,0.12)"
                : "rgba(255,255,255,0.03)",
              border: isSelected
                ? `1px solid ${OVERLAY_COLOR}`
                : "1px solid transparent",
              cursor: onSelectIndicator ? "pointer" : "default",
            }}
          >
            <div className="flex items-center gap-2">
              {isSelected && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: OVERLAY_COLOR }}
                />
              )}
              <span className="text-sm font-medium text-rh-text">{indicator.name}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-rh-muted tabular-nums">
                r={indicator.correlation.toFixed(2)}&nbsp;&nbsp;d={indicator.direction > 0 ? "+" : ""}{indicator.direction.toFixed(2)}
              </span>
              <span className="text-xs font-medium" style={{ color: cfg.color }}>
                {cfg.text}
              </span>
              <div
                className="flex h-8 w-12 items-center justify-center rounded-md text-base font-bold tracking-tighter"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {cfg.arrows}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
