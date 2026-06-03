"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  Account,
  PortfolioHistory,
  Position,
  TimeRange,
  Watchlist,
} from "@/types/portfolio";

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export function usePortfolio(range: TimeRange) {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Account / positions / watchlist load once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, p, w] = await Promise.all([
          json<Account>("/api/account"),
          json<Position[]>("/api/positions"),
          json<Watchlist>("/api/watchlist"),
        ]);
        if (!alive) return;
        setAccount(a);
        setPositions(p);
        setWatchlist(w);
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // History reloads whenever the range changes.
  const loadHistory = useCallback(async (r: TimeRange) => {
    setLoadingHistory(true);
    try {
      const h = await json<PortfolioHistory>(`/api/portfolio-history?range=${r}`);
      setHistory(h);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(range);
  }, [range, loadHistory]);

  return { account, positions, watchlist, history, loadingHistory, error };
}
