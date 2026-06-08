"use client";

import { useEffect, useState } from "react";
import type { MacroIndicator } from "@/components/MacroIndicators";

export function useMacroIndicators(symbol: string) {
  const [indicators, setIndicators] = useState<MacroIndicator[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/macro-indicators/${symbol}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setIndicators(data.indicators);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbol]);

  return { indicators, loading, error };
}
