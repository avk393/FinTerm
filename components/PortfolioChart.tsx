"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import type { PortfolioHistory, TimeRange } from "@/types/portfolio";
import type { ObsPoint } from "@/hooks/useIndicatorObservations";

interface PortfolioChartProps {
  history: PortfolioHistory;
  onScrub: (index: number | null) => void;
  up?: boolean;
  height?: number;
  overlayPoints?: ObsPoint[] | null;
  overlayLabel?: string;
}

const GREEN = "#00c805";
const RED = "#ff5000";
const OVERLAY_COLOR = "#818cf8";
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

function formatOverlayValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + "K";
  if (Math.abs(v) < 10) return v.toFixed(2);
  return v.toFixed(1);
}

export default function PortfolioChart({
  history,
  onScrub,
  up,
  height = 260,
  overlayPoints,
  overlayLabel,
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

  // Overlay geometry — mapped to the stock chart's time window
  const overlayGeo = useMemo(() => {
    if (!overlayPoints || overlayPoints.length < 2 || points.length < 2) return null;

    const tMin = points[0].t;
    const tMax = points[points.length - 1].t;
    if (tMax <= tMin) return null;

    const vals = overlayPoints.map((p) => p.v);
    const oMin = Math.min(...vals);
    const oMax = Math.max(...vals);
    const oRange = oMax - oMin || 1;

    const gox = (t: number) => ((t - tMin) / (tMax - tMin)) * W;
    const goy = (v: number) => H - padY - ((v - oMin) / oRange) * (H - padY * 2);

    const visiblePoints = overlayPoints.filter(
      (p) => p.t >= tMin && p.t <= tMax
    );

    if (visiblePoints.length < 2) return null;

    const path = visiblePoints
      .map((p, i) => `${i === 0 ? "M" : "L"}${gox(p.t).toFixed(1)},${goy(p.v).toFixed(1)}`)
      .join(" ");

    // 3 evenly-spaced Y-axis labels for the secondary axis
    const axisLabels = [0, 0.5, 1].map((frac) => {
      const v = oMin + frac * oRange;
      const y = goy(v);
      return { v, y };
    });

    return { path, axisLabels, oMin, oMax };
  }, [overlayPoints, points, H, padY, W]);

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
      {overlayLabel && (
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-block w-3 h-0.5 rounded"
            style={{ background: OVERLAY_COLOR }}
          />
          <span className="text-xs" style={{ color: OVERLAY_COLOR }}>
            {overlayLabel}
            {!overlayGeo && overlayPoints !== null && (
              <span className="text-rh-muted ml-1">(no data for this period)</span>
            )}
          </span>
        </div>
      )}

      <div className="relative">
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

          {/* Full stock line dims to grey when scrubbing */}
          <path
            d={linePath}
            fill="none"
            stroke={hover != null ? "#4a4a4a" : color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Segment up to cursor stays colored */}
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

          {/* Overlay indicator line */}
          {overlayGeo && (
            <>
              <path
                d={overlayGeo.path}
                fill="none"
                stroke={OVERLAY_COLOR}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray="6 3"
                vectorEffect="non-scaling-stroke"
                opacity={0.85}
              />
              {/* Right-side Y-axis ticks */}
              {overlayGeo.axisLabels.map(({ y }, i) => (
                <line
                  key={i}
                  x1={W - 8}
                  x2={W}
                  y1={y}
                  y2={y}
                  stroke={OVERLAY_COLOR}
                  strokeWidth={1}
                  opacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </>
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

        {/* Secondary Y-axis labels (HTML positioned over chart) */}
        {overlayGeo && (
          <div className="pointer-events-none absolute inset-0">
            {overlayGeo.axisLabels.map(({ v, y }, i) => {
              const pct = (y / H) * 100;
              return (
                <span
                  key={i}
                  className="absolute right-0 text-[10px] tabular-nums pr-1"
                  style={{
                    top: `${pct}%`,
                    transform: "translateY(-50%)",
                    color: OVERLAY_COLOR,
                    opacity: 0.75,
                  }}
                >
                  {formatOverlayValue(v)}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Time labels */}
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
