// Server-side Perplexity API client. Import only from API route handlers.

import type { NewsArticle } from "@/types/portfolio";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const BASE_URL = "https://api.perplexity.ai";

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: { content: string };
  }>;
  citations?: string[];
}

async function chat(messages: PerplexityMessage[]): Promise<PerplexityResponse> {
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not set");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages,
      temperature: 0.2,
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${await res.text()}`);
  return res.json() as Promise<PerplexityResponse>;
}

interface RawArticle {
  title: string;
  summary: string;
  symbol: string | string[];
  source: string;
  publishedAt?: string;
}

export async function getPortfolioNews(symbols: string[]): Promise<NewsArticle[]> {
  if (!symbols.length) return [];

  const symbolList = symbols.join(", ");

  const response = await chat([
    {
      role: "system",
      content:
        "You are a financial news assistant. Return only valid JSON with no markdown fences or extra text.",
    },
    {
      role: "user",
      content: `Find the 8 most recent and important news articles (last 7 days) relevant to these stock symbols: ${symbolList}.

Return a JSON array where each element has exactly these fields:
- "title": headline string
- "summary": 1-2 sentence summary string
- "symbol": the ticker symbol this article most relates to (string)
- "source": publication name string
- "publishedAt": ISO 8601 date string if known, otherwise omit

Return only the JSON array, nothing else.`,
    },
  ]);

  const content = response.choices[0]?.message?.content ?? "[]";
  const citations: string[] = response.citations ?? [];

  let raw: RawArticle[];
  try {
    raw = JSON.parse(content);
    if (!Array.isArray(raw)) raw = [];
  } catch {
    raw = [];
  }

  return raw.map((item, i) => ({
    title: item.title ?? "Untitled",
    summary: item.summary ?? "",
    url: citations[i] ?? "",
    source: item.source ?? "Unknown",
    publishedAt: item.publishedAt,
    symbols: Array.isArray(item.symbol) ? item.symbol : [item.symbol].filter(Boolean),
  }));
}
