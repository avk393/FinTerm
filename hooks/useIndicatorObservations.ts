"use client";

import { useEffect, useState } from "react";
import type { TimeRange } from "@/types/portfolio";

export interface ObsPoint {
  t: number;
  v: number;
}

function getDateRange(range: TimeRange): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: Date;

  switch (range) {
    case "1D":
      start = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      break;
    case "1W":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1M":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "3M":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "YTD":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "1Y":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case "ALL":
      start = new Date(0);
      break;
  }

  return { start: start.toISOString().split("T")[0], end };
}

export function useIndicatorObservations(
  indicatorId: number | null,
  range: TimeRange
) {
  const [points, setPoints] = useState<ObsPoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (indicatorId == null) {
      setPoints(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const { start, end } = getDateRange(range);
    fetch(`/api/indicator-observations/${indicatorId}?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPoints(data.points ?? null);
      })
      .catch(() => {
        if (!cancelled) setPoints(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [indicatorId, range]);

  return { points, loading };
}
