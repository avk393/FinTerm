"use client";

import { useEffect, useState } from "react";
import type { NewsArticle } from "@/types/portfolio";

interface Props {
  symbol: string;
}

function firstFourSentences(text: string): string {
  const matches = text.match(/[^.!?]*[.!?]+/g);
  if (!matches) return text;
  return matches.slice(0, 4).join(" ").trim();
}

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StockNews({ symbol }: Props) {
  const [articles, setArticles] = useState<NewsArticle[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setArticles(null);
    fetch(`/api/news/${symbol}`)
      .then((r) => r.json())
      .then((data) => setArticles(Array.isArray(data) ? data : []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 animate-pulse rounded bg-rh-elevated" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-rh-elevated" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-rh-elevated" />
          </div>
        ))}
      </div>
    );
  }

  if (!articles?.length) {
    return <p className="text-sm text-rh-muted">No recent news found.</p>;
  }

  return (
    <div className="rh-scroll max-h-[600px] overflow-y-auto -mx-6 -mb-6">
      {articles.map((article, i) => (
        <a
          key={i}
          href={article.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-t border-rh-border px-6 py-3 transition-colors hover:bg-rh-elevated first:border-t-0"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] text-rh-muted">{article.source}</span>
            <span className="text-[11px] text-rh-muted">·</span>
            <span className="text-[11px] text-rh-muted">{timeAgo(article.publishedAt)}</span>
          </div>
          <p className="text-sm font-semibold leading-snug">{article.title}</p>
          {article.summary && (
            <p className="mt-1 text-xs leading-relaxed text-rh-muted line-clamp-2">
              {firstFourSentences(article.summary)}
            </p>
          )}
        </a>
      ))}
    </div>
  );
}
