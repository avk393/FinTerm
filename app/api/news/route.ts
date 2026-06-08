import { NextResponse } from "next/server";
import { getPositions } from "@/lib/alpaca";
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

function buildQuery(symbols: string[]): string {
  const terms = symbols.map((s) => `tt:${s.toLowerCase()}`);
  const combined = terms.length === 1 ? terms[0] : `(or ${terms.join(" ")})`;
  return `(diff ${combined} T:ugc)`;
}

function extractSymbols(tags: string[] | undefined, portfolioSymbols: Set<string>): string[] {
  if (!tags) return [];
  return tags
    .filter((t) => t.startsWith("z:") || t.startsWith("tt:"))
    .map((t) => t.split(":")[1].toUpperCase())
    .filter((sym, i, arr) => arr.indexOf(sym) === i && portfolioSymbols.has(sym));
}

export async function GET() {
  try {
    const positions = await getPositions();
    const symbols = positions.map((p) => p.symbol);
    if (!symbols.length) return NextResponse.json([]);

    const query = buildQuery(symbols);
    const url = `${TICKERTICK_BASE}/feed?q=${encodeURIComponent(query)}&n=20`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`TickerTick ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as TTFeedResponse;
    const portfolioSymbols = new Set(symbols);

    const articles: NewsArticle[] = (data.stories ?? []).map((story) => ({
      title: story.title,
      summary: story.description ?? "",
      url: story.url,
      source: story.site,
      publishedAt: new Date(story.time).toISOString(),
      symbols: extractSymbols(story.tags, portfolioSymbols),
    }));

    return NextResponse.json(articles);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
