"use client";

import type { TimeRange } from "@/types/portfolio";

const RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

interface Props {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
  /** Active color follows the chart's gain/loss tone. */
  isUp: boolean;
}

export default function TimeRangeSelector({ value, onChange, isUp }: Props) {
  const active = isUp ? "text-rh-green" : "text-rh-red";
  const bar = isUp ? "bg-rh-green" : "bg-rh-red";

  return (
    <div className="flex items-center gap-6 border-b border-rh-border pb-px">
      {RANGES.map((r) => {
        const selected = r === value;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={`relative pb-2 text-sm font-bold transition-colors ${
              selected ? active : "text-rh-muted hover:text-rh-text"
            }`}
          >
            {r}
            {selected && (
              <span className={`absolute -bottom-px left-0 h-0.5 w-full rounded ${bar}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
