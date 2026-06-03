"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color: string;
}

/** Tiny dependency-free sparkline with a faint baseline, like Robinhood's. */
export default function Sparkline({
  data,
  width = 72,
  height = 32,
  color,
}: SparklineProps) {
  if (data.length < 2) return <svg width={width} height={height} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const x = (i: number) => (i / (data.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);

  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const baseY = y(data[0]);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <line
        x1={pad}
        x2={width - pad}
        y1={baseY}
        y2={baseY}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={0.35}
      />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
