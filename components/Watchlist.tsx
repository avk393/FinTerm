"use client";

import type { NewsArticle } from "@/types/portfolio";

function firstFourSentences(text: string): string {
  const matches = text.match(/[^.!?]*[.!?]+/g);
  if (!matches) return text;
  return matches.slice(0, 4).join(" ").trim();
}

interface Props {
  news: NewsArticle[] | null;
  loading?: boolean;
}

export default function Watchlist({ news, loading }: Props) {
  return (
    <aside className="self-start rounded-xl border border-rh-border bg-rh-bg">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="text-base font-bold">Portfolio News</h2>
      </div>

      <div className="rh-scroll max-h-[640px] overflow-y-auto">
        {loading && (
          <div className="space-y-3 px-4 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 animate-pulse rounded bg-rh-elevated" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-rh-elevated" />
              </div>
            ))}
          </div>
        )}

        {!loading && news?.length === 0 && (
          <p className="px-4 py-6 text-sm text-rh-muted">No recent news found.</p>
        )}

        {news?.map((article, i) => (
          <a
            key={i}
            href={article.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="block border-t border-rh-border px-4 py-3 transition-colors hover:bg-rh-elevated"
          >
            <div className="mb-1 flex items-center gap-2">
              {article.symbols.map((sym) => (
                <span
                  key={sym}
                  className="rounded bg-rh-elevated px-1.5 py-0.5 text-[11px] font-bold text-rh-green"
                >
                  {sym}
                </span>
              ))}
              <span className="text-[11px] text-rh-muted">{article.source}</span>
            </div>
            <p className="text-sm font-semibold leading-snug">{article.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-rh-muted">{firstFourSentences(article.summary)}</p>
          </a>
        ))}
      </div>
    </aside>
  );
}
