"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import type { PortfolioHistory, TimeRange } from "@/types/portfolio";

interface PortfolioChartProps {
  history: PortfolioHistory;
  /** Reports the hovered point index (or null when not scrubbing). */
  onScrub: (index: number | null) => void;
  up?: boolean;
  height?: number;
}

const GREEN = "#00c805";
const RED = "#ff5000";
const LABEL_COUNT = 5;

function formatTimeLabel(t: number, range: TimeRange): string {
  const d = new Date(t);
  switch (range) {
    case "1D":
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    case "1W":
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    case "1M":
    case "3M":
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "YTD":
    case "1Y":
    case "ALL":
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
}

export default function PortfolioChart({
  history,
  onScrub,
  up,
  height = 260,
}: PortfolioChartProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const padY = 24;

  const { points, color, baseY, geoX, geoY } = useMemo(() => {
    const pts = history.points;
    const vals = pts.map((p) => p.v);
    const min = Math.min(...vals, history.baseValue);
    const max = Math.max(...vals, history.baseValue);
    const range = max - min || 1;
    const isUp = up ?? (pts.length ? pts[pts.length - 1].v >= history.baseValue : true);

    const gx = (i: number) => (i / Math.max(pts.length - 1, 1)) * W;
    const gy = (v: number) => H - padY - ((v - min) / range) * (H - padY * 2);

    return {
      points: pts,
      color: isUp ? GREEN : RED,
      baseY: gy(history.baseValue),
      geoX: gx,
      geoY: gy,
    };
  }, [history, H, up]);

  // Evenly-spaced label indices as percentages of the viewBox width.
  const labels = useMemo(() => {
    if (points.length < 2) return [];
    return Array.from({ length: LABEL_COUNT }, (_, i) => {
      const idx = Math.round((i / (LABEL_COUNT - 1)) * (points.length - 1));
      return {
        idx,
        pct: (geoX(idx) / W) * 100,
        text: formatTimeLabel(points[idx].t, history.range),
      };
    });
  }, [points, geoX, history.range]);

  const linePath = useMemo(
    () => points.map((p, i) => `${i === 0 ? "M" : "L"}${geoX(i)},${geoY(p.v)}`).join(" "),
    [points, geoX, geoY]
  );

  const headPath = useMemo(() => {
    if (hover == null) return linePath;
    return points
      .slice(0, hover + 1)
      .map((p, i) => `${i === 0 ? "M" : "L"}${geoX(i)},${geoY(p.v)}`)
      .join(" ");
  }, [hover, linePath, points, geoX, geoY]);

  const handleMove = useCallback(
    (clientX: number) => {
      const svg = ref.current;
      if (!svg || points.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const idx = Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
      setHover(idx);
      onScrub(idx);
    },
    [points.length, onScrub]
  );

  const clear = () => {
    setHover(null);
    onScrub(null);
  };

  const cursorX = hover != null ? geoX(hover) : 0;
  const cursorY = hover != null ? geoY(points[hover].v) : 0;

  return (
    <div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        className="touch-none select-none"
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseLeave={clear}
        onTouchStart={(e) => handleMove(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={clear}
      >
        {/* Dashed baseline */}
        <line
          x1={0}
          x2={W}
          y1={baseY}
          y2={baseY}
          stroke="#3a3a3a"
          strokeWidth={1}
          strokeDasharray="2 4"
        />

        {/* Full line dims to grey when scrubbing... */}
        <path
          d={linePath}
          fill="none"
          stroke={hover != null ? "#4a4a4a" : color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* ...segment up to cursor stays colored */}
        {hover != null && (
          <path
            d={headPath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Crosshair + dot */}
        {hover != null && (
          <>
            <line
              x1={cursorX}
              x2={cursorX}
              y1={0}
              y2={H}
              stroke="#5a5a5a"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={cursorX} cy={cursorY} r={5} fill={color} vectorEffect="non-scaling-stroke" />
            <circle cx={cursorX} cy={cursorY} r={5} fill="none" stroke="#000" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>

      {/* Time labels rendered as HTML to avoid SVG text distortion */}
      <div className="relative h-5 mt-1 select-none">
        {labels.map(({ idx, pct, text }, i) => (
          <span
            key={idx}
            className="absolute text-[11px] text-rh-muted whitespace-nowrap"
            style={{
              left: `${pct}%`,
              transform:
                i === 0
                  ? "none"
                  : i === labels.length - 1
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
            }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
