"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import type { PortfolioHistory } from "@/types/portfolio";

interface PortfolioChartProps {
  history: PortfolioHistory;
  /** Reports the hovered point index (or null when not scrubbing). */
  onScrub: (index: number | null) => void;
  /**
   * Optional tone override. When provided, the line color follows this
   * instead of the chart's own first-vs-last comparison, keeping the
   * chart, summary, and range tabs in agreement.
   */
  up?: boolean;
  height?: number;
}

const GREEN = "#00c805";
const RED = "#ff5000";

/**
 * Robinhood-style equity chart:
 *  - line colored green/red by whole-period gain/loss
 *  - dashed horizontal baseline at the period's starting value
 *  - pointer scrubbing that emits the hovered index upward
 *  - portion of the line after the cursor dims while scrubbing
 */
export default function PortfolioChart({
  history,
  onScrub,
  up,
  height = 260,
}: PortfolioChartProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000; // viewBox width; SVG scales to container
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

  const linePath = useMemo(
    () => points.map((p, i) => `${i === 0 ? "M" : "L"}${geoX(i)},${geoY(p.v)}`).join(" "),
    [points, geoX, geoY]
  );

  // Split the path at the cursor so the trailing part can be dimmed.
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
      {/* Dashed baseline at the period's opening value */}
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
      {/* ...and the segment up to the cursor stays colored */}
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
  );
}
