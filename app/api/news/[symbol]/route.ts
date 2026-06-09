import { NextResponse } from "next/server";
import type { NewsArticle } from "@/types/portfolio";

export const dynamic = "force-dynamic";

const TICKERTICK_BASE = "https://api.tickertick.com";

interface TTStory {
  id: string;
  title: string;
  url: string;
  site: string;
  time: number;
  tags?: string[];
  description?: string;
}

interface TTFeedResponse {
  stories: TTStory[];
}

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await params;
    const ticker = symbol.toLowerCase();

    const query = `(diff (or TT:${ticker} (and tt:${ticker} (or T:fin_news T:analysis T:industry))) T:ugc)`;
    const url = `${TICKERTICK_BASE}/feed?q=${encodeURIComponent(query)}&n=30`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`TickerTick ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as TTFeedResponse;

    const articles: NewsArticle[] = (data.stories ?? []).map((story) => ({
      title: story.title,
      summary: story.description ?? "",
      url: story.url,
      source: story.site,
      publishedAt: new Date(story.time).toISOString(),
      symbols: [symbol.toUpperCase()],
    }));

    return NextResponse.json(articles);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
