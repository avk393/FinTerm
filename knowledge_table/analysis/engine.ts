import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { getClient } from '../ingestion/engine'
import type { BeliefSignal } from '../ingestion/types'

// ---------- Public types ----------

export interface MatchedBelief {
  id: string
  belief: string
  category: string
  matched: boolean
  matchedSignals: string[] // e.g. "pe_ratio (72) > 60"
}

export interface RetrievedChunk {
  content: string
  sourceTitle: string
  sourceType: string
  similarity: number
}

export interface AnalysisSignal {
  belief: string
  alignment: 'aligns' | 'conflicts' | 'neutral'
  confidence: number // 0..1
  reasoning: string  // 1-2 sentences citing evidence
}

export interface AnalysisResult {
  ticker: string
  signals: AnalysisSignal[]
  summary: string
  cached: boolean
  generatedAt: string
}

// ---------- Signal matching ----------

function evalSignal(sig: BeliefSignal, fundamentals: Record<string, number | boolean>): boolean {
  const val = fundamentals[sig.field]
  if (val === undefined) return false
  switch (sig.op) {
    case '>':  return (val as number) > (sig.value as number)
    case '<':  return (val as number) < (sig.value as number)
    case '>=': return (val as number) >= (sig.value as number)
    case '<=': return (val as number) <= (sig.value as number)
    // eslint-disable-next-line eqeqeq
    case '==': return val == sig.value
    // eslint-disable-next-line eqeqeq
    case '!=': return val != sig.value
    default:   return false
  }
}

function fmtSignal(sig: BeliefSignal, fundamentals: Record<string, number | boolean>): string {
  const val = fundamentals[sig.field] ?? '?'
  return `${sig.field} (${val}) ${sig.op} ${sig.value}`
}

export async function matchSignals(
  _ticker: string,
  fundamentals: Record<string, number | boolean>,
): Promise<MatchedBelief[]> {
  const db = await getClient()
  try {
    const { rows } = await db.query<{
      id: string
      belief: string
      category: string
      signals: BeliefSignal[]
    }>(`SELECT id, belief, category, signals FROM thesis_beliefs WHERE active = true`)

    return rows.map(row => {
      const sigs: BeliefSignal[] = Array.isArray(row.signals) ? row.signals : []
      const matchedSignals: string[] = []
      let matched = sigs.length > 0

      for (const sig of sigs) {
        if (evalSignal(sig, fundamentals)) {
          matchedSignals.push(fmtSignal(sig, fundamentals))
        } else {
          matched = false
        }
      }

      return { id: row.id, belief: row.belief, category: row.category, matched, matchedSignals }
    })
  } finally {
    db.release()
  }
}

// ---------- Full-text search retrieval (no external embedding API required) ----------

export async function retrieveChunks(
  ticker: string,
  sector: string,
  beliefText: string,
  k = 6,
): Promise<RetrievedChunk[]> {
  const db = await getClient()
  try {
    // Primary: full-text search ranked by relevance to the belief text
    const { rows } = await db.query<{
      content: string
      title: string
      source_type: string
      similarity: number
    }>(
      `SELECT kc.content, ks.title, ks.source_type,
              ts_rank(to_tsvector('english', kc.content), plainto_tsquery('english', $1)) AS similarity
       FROM knowledge_chunks kc
       JOIN knowledge_sources ks ON ks.id = kc.source_id
       WHERE (kc.metadata->'tickers' ? $2 OR kc.metadata->>'sector' = $3)
         AND to_tsvector('english', kc.content) @@ plainto_tsquery('english', $1)
       ORDER BY similarity DESC
       LIMIT $4`,
      [beliefText, ticker, sector, k],
    )

    if (rows.length > 0) {
      return rows.map(row => ({
        content: row.content,
        sourceTitle: row.title,
        sourceType: row.source_type,
        similarity: Number(row.similarity),
      }))
    }

    // Fallback: metadata filter only, ordered by recency
    const { rows: fallback } = await db.query<{
      content: string
      title: string
      source_type: string
    }>(
      `SELECT kc.content, ks.title, ks.source_type
       FROM knowledge_chunks kc
       JOIN knowledge_sources ks ON ks.id = kc.source_id
       WHERE kc.metadata->'tickers' ? $1 OR kc.metadata->>'sector' = $2
       ORDER BY kc.created_at DESC
       LIMIT $3`,
      [ticker, sector, k],
    )

    return fallback.map(row => ({
      content: row.content,
      sourceTitle: row.title,
      sourceType: row.source_type,
      similarity: 0,
    }))
  } finally {
    db.release()
  }
}

// ---------- Cache ----------

export function computeCacheKey(ticker: string, activeBeliefIds: string[]): string {
  const date = new Date().toISOString().slice(0, 10)
  const sorted = [...activeBeliefIds].sort().join(',')
  return crypto.createHash('sha256').update(`${ticker}|${sorted}|${date}`).digest('hex')
}

export async function getCachedAnalysis(
  ticker: string,
  cacheKey: string,
): Promise<AnalysisResult | null> {
  const db = await getClient()
  try {
    const { rows } = await db.query<{ response: unknown }>(
      `SELECT response FROM analysis_cache
       WHERE ticker = $1 AND cache_key = $2 AND expires_at > NOW()`,
      [ticker, cacheKey],
    )
    if (!rows.length) return null
    const result = rows[0].response as AnalysisResult
    result.cached = true
    return result
  } finally {
    db.release()
  }
}

export async function writeCachedAnalysis(
  ticker: string,
  cacheKey: string,
  result: AnalysisResult,
): Promise<void> {
  const db = await getClient()
  try {
    await db.query(
      `INSERT INTO analysis_cache (ticker, cache_key, response, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '6 hours')
       ON CONFLICT (ticker, cache_key)
       DO UPDATE SET response = EXCLUDED.response, expires_at = EXCLUDED.expires_at`,
      [ticker, cacheKey, JSON.stringify(result)],
    )
  } finally {
    db.release()
  }
}

// ---------- Claude prompt ----------

const SYSTEM_PROMPT =
  'You are an investment analyst reasoning about whether a stock aligns with the user\'s investment theses.\n' +
  'Use your own knowledge of the company identified by its ticker — its business, financials, competitive position, and recent developments — to judge each belief.\n' +
  'Return ONLY valid JSON matching this exact shape, with no markdown, preamble, or explanation:\n' +
  '{"signals":[{"belief":"string","alignment":"aligns|conflicts|neutral","confidence":0.0,"reasoning":"1-2 sentences citing specific facts about the company that drove the decision"}],"summary":"2-3 sentence overall take on whether this stock fits the investment thesis"}'

function buildPrompt(
  ticker: string,
  beliefs: MatchedBelief[],
): string {
  const lines: string[] = []

  lines.push(`## Stock: ${ticker}`)

  lines.push('\n## Investment Thesis Beliefs')
  for (const b of beliefs) {
    lines.push(`- [${b.category ?? 'uncategorized'}] ${b.belief}`)
    if (b.matchedSignals.length > 0) {
      lines.push(`  Matched signals: ${b.matchedSignals.join(', ')}`)
    }
  }

  lines.push(
    `\nFor each belief listed above, determine alignment (aligns/conflicts/neutral) for ${ticker}, ` +
    'a confidence score between 0 and 1, and cite specific facts about the company in the reasoning.',
  )

  return lines.join('\n')
}

async function callClaude(
  anthropic: Anthropic,
  message: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: message }],
  })
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude')
  return block.text
}

function parseClaudeResponse(
  ticker: string,
  raw: string,
): AnalysisResult {
  const parsed = JSON.parse(raw) as { signals: AnalysisSignal[]; summary: string }
  return {
    ticker,
    signals: parsed.signals,
    summary: parsed.summary,
    cached: false,
    generatedAt: '',
  }
}

// ---------- Main orchestrator ----------

export async function generateAnalysis(
  ticker: string,
  fundamentals: Record<string, number | boolean>,
): Promise<AnalysisResult> {
  const beliefs = await matchSignals(ticker, fundamentals)

  if (!beliefs.length) {
    return {
      ticker,
      signals: [],
      summary:
        'No investment theses are currently configured. ' +
        'Add thesis beliefs via the knowledge base ingestion to get analysis signals.',
      cached: false,
      generatedAt: new Date().toISOString(),
    }
  }

  const cacheKey = computeCacheKey(ticker, beliefs.map(b => b.id))

  const hit = await getCachedAnalysis(ticker, cacheKey)
  if (hit) return hit

  const prompt = buildPrompt(ticker, beliefs)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let raw = await callClaude(anthropic, prompt)

  let result: AnalysisResult
  try {
    result = parseClaudeResponse(ticker, raw)
  } catch {
    // Retry with a stricter prompt on malformed JSON
    raw = await callClaude(
      anthropic,
      `Your previous response was not valid JSON. Return ONLY the corrected JSON — no preamble, no markdown.\n\nPrevious response:\n${raw}\n\nOriginal prompt:\n${prompt}`,
    )
    result = parseClaudeResponse(ticker, raw)
  }

  result.cached = false
  result.generatedAt = new Date().toISOString()

  await writeCachedAnalysis(ticker, cacheKey, result)
  return result
}
