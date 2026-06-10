import { Pool, PoolClient } from 'pg'
import { YoutubeTranscript } from 'youtube-transcript'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { basename } from 'path'
import type { ChunkMetadata, IngestionResult, ThesisBelief } from './types'

// ---------- DB connection ----------

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is not set')
    pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL })
  }
  return pool
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect()
}

// ---------- Chunking ----------

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  // 1 token ≈ 0.75 words → chunkSize tokens ≈ chunkSize × 0.75 words
  const wordsPerChunk = Math.max(1, Math.floor(chunkSize * 0.75))
  const overlapWords = Math.max(0, Math.min(Math.floor(overlap * 0.75), wordsPerChunk - 1))
  const step = wordsPerChunk - overlapWords

  const words = text.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return []

  const chunks: string[] = []
  for (let i = 0; i < words.length; i += step) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
  }
  return chunks
}

// ---------- Embedding ----------

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100)
    const response = await client.embeddings.create({ model: 'text-embedding-3-small', input: batch })
    // preserve insertion order
    results.push(...response.data.sort((a, b) => a.index - b.index).map(e => e.embedding))
  }
  return results
}

// ---------- Internal helpers ----------

function toVectorString(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

async function bulkInsertChunks(
  client: PoolClient,
  sourceId: string,
  chunks: string[],
  embeddings: number[][],
  metadata: ChunkMetadata,
): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    await client.query(
      `INSERT INTO knowledge_chunks (source_id, chunk_index, content, embedding, metadata)
       VALUES ($1, $2, $3, $4::vector, $5)`,
      [sourceId, i, chunks[i], toVectorString(embeddings[i]), JSON.stringify(metadata)],
    )
  }
}

// ---------- ingestPdf ----------

export async function ingestPdf(
  filepath: string,
  metadata: Partial<ChunkMetadata>,
): Promise<IngestionResult> {
  const buffer = readFileSync(filepath)
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const pdf = await parser.getText()
  const title = basename(filepath)
  const merged: ChunkMetadata = { tickers: [], sector: '', ...metadata }

  const chunks = chunkText(pdf.text)
  const embeddings = await embedTexts(chunks)

  const db = await getClient()
  try {
    await db.query('BEGIN')
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO knowledge_sources (title, source_type, url) VALUES ($1, 'pdf', $2) RETURNING id`,
      [title, filepath],
    )
    const sourceId = rows[0].id
    await bulkInsertChunks(db, sourceId, chunks, embeddings, merged)
    await db.query('COMMIT')
    return { sourceId, chunkCount: chunks.length, title }
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  } finally {
    db.release()
  }
}

// ---------- ingestYoutube ----------

export async function ingestYoutube(
  url: string,
  metadata: Partial<ChunkMetadata>,
): Promise<IngestionResult> {
  const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([^&?/]+)/)
  if (!match) throw new Error(`Could not extract video ID from URL: ${url}`)
  const videoId = match[1]

  let transcript: string
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    transcript = segments.map(s => s.text).join(' ')
  } catch {
    throw new Error(`Transcript unavailable for video: ${videoId}`)
  }

  let title = videoId
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (apiKey) {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`,
      )
      const json = await res.json() as { items?: Array<{ snippet?: { title?: string } }> }
      title = json.items?.[0]?.snippet?.title ?? videoId
    }
  } catch {
    // fall back to videoId
  }

  const merged: ChunkMetadata = { tickers: [], sector: '', ...metadata }
  const chunks = chunkText(transcript)
  const embeddings = await embedTexts(chunks)

  const db = await getClient()
  try {
    await db.query('BEGIN')
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO knowledge_sources (title, source_type, url) VALUES ($1, 'youtube', $2) RETURNING id`,
      [title, url],
    )
    const sourceId = rows[0].id
    await bulkInsertChunks(db, sourceId, chunks, embeddings, merged)
    await db.query('COMMIT')
    return { sourceId, chunkCount: chunks.length, title }
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  } finally {
    db.release()
  }
}

// ---------- ingestText ----------

export async function ingestText(
  text: string,
  title: string,
  metadata: Partial<ChunkMetadata>,
): Promise<IngestionResult> {
  const merged: ChunkMetadata = { tickers: [], sector: '', ...metadata }
  const chunks = chunkText(text)
  const embeddings = await embedTexts(chunks)

  const db = await getClient()
  try {
    await db.query('BEGIN')
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO knowledge_sources (title, source_type) VALUES ($1, 'manual') RETURNING id`,
      [title],
    )
    const sourceId = rows[0].id
    await bulkInsertChunks(db, sourceId, chunks, embeddings, merged)
    await db.query('COMMIT')
    return { sourceId, chunkCount: chunks.length, title }
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  } finally {
    db.release()
  }
}

// ---------- ingestThesis ----------

export async function ingestThesis(text: string): Promise<string[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const system =
    'Extract investment thesis beliefs from the provided text. ' +
    'Return ONLY a JSON array with no preamble, markdown, or explanation. ' +
    'Each element must match exactly: ' +
    '[{"belief":"string","category":"string","signals":[{"field":"string","op":">|<|>=|<=|==|!=","value":number_or_string_or_boolean}]}]'

  async function callClaude(message: string): Promise<string> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: message }],
    })
    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude')
    return block.text
  }

  let raw = await callClaude(text)

  let beliefs: ThesisBelief[]
  try {
    beliefs = JSON.parse(raw) as ThesisBelief[]
  } catch {
    raw = await callClaude(
      `Your previous response was not valid JSON. Return ONLY the corrected JSON array — no preamble, no markdown.\n\nPrevious response:\n${raw}\n\nOriginal text:\n${text}`,
    )
    try {
      beliefs = JSON.parse(raw) as ThesisBelief[]
    } catch {
      throw new Error(`Failed to parse thesis JSON after retry. Raw Claude response:\n${raw}`)
    }
  }

  const db = await getClient()
  try {
    await db.query('BEGIN')
    const ids: string[] = []
    for (const belief of beliefs) {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO thesis_beliefs (belief, category, signals) VALUES ($1, $2, $3) RETURNING id`,
        [belief.belief, belief.category, JSON.stringify(belief.signals)],
      )
      ids.push(rows[0].id)
    }
    await db.query('COMMIT')
    return ids
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  } finally {
    db.release()
  }
}

// ---------- purgeExpiredCache ----------

export async function purgeExpiredCache(): Promise<number> {
  const db = await getClient()
  try {
    const result = await db.query(`DELETE FROM analysis_cache WHERE expires_at < NOW()`)
    return result.rowCount ?? 0
  } finally {
    db.release()
  }
}
