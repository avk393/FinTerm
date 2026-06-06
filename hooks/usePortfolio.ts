"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  Account,
  NewsArticle,
  PortfolioHistory,
  Position,
  TimeRange,
} from "@/types/portfolio";

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export function usePortfolio(range: TimeRange) {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [news, setNews] = useState<NewsArticle[] | null>(null);
  const [loadingNews, setLoadingNews] = useState(true);
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Account and positions load once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, p] = await Promise.all([
          json<Account>("/api/account"),
          json<Position[]>("/api/positions"),
        ]);
        if (!alive) return;
        setAccount(a);
        setPositions(p);
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // News loads once (Perplexity call is slow; keep it separate so the rest renders first).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const articles = await json<NewsArticle[]>("/api/news");
        if (alive) setNews(articles);
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoadingNews(false);
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

  return { account, positions, news, loadingNews, history, loadingHistory, error };
}
