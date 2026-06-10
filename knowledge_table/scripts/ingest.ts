import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local then .env before any engine functions read process.env.
// Static imports above are evaluated first, but engine.ts reads env vars
// inside function bodies, so they'll see the values set here.
function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx < 0) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (key && process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    } catch {
      // file not found — continue
    }
  }
}

loadEnv()

import {
  ingestPdf,
  ingestYoutube,
  ingestText,
  ingestThesis,
  purgeExpiredCache,
} from '../ingestion/engine'

// ---------- Arg parsing ----------

function parseArgs(args: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {}
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (key.includes('=')) {
        const eqIdx = key.indexOf('=')
        flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1)
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[i + 1]
        i++
      } else {
        flags[key] = 'true'
      }
    } else {
      positional.push(arg)
    }
  }

  return { flags, positional }
}

// ---------- CLI ----------

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv

  if (!command) {
    console.error('Usage: npx tsx knowledge_table/scripts/ingest.ts <command> [args]')
    console.error('Commands: pdf, youtube, text, thesis, purge')
    process.exit(1)
  }

  const { flags, positional } = parseArgs(rest)

  const metadata = {
    tickers: flags.tickers ? flags.tickers.split(',').map(t => t.trim()) : [],
    sector: flags.sector ?? '',
  }

  switch (command) {
    case 'pdf': {
      const filepath = positional[0]
      if (!filepath) { console.error('pdf requires a filepath'); process.exit(1) }
      const r = await ingestPdf(filepath, metadata)
      console.log(`Source ID:   ${r.sourceId}`)
      console.log(`Chunk count: ${r.chunkCount}`)
      console.log(`Title:       ${r.title}`)
      break
    }

    case 'youtube': {
      const url = positional[0]
      if (!url) { console.error('youtube requires a URL'); process.exit(1) }
      const r = await ingestYoutube(url, metadata)
      console.log(`Source ID:   ${r.sourceId}`)
      console.log(`Chunk count: ${r.chunkCount}`)
      console.log(`Title:       ${r.title}`)
      break
    }

    case 'text': {
      const rawText = positional[0]
      const title = flags.title ?? 'Untitled'
      if (!rawText) { console.error('text requires raw text as first argument'); process.exit(1) }
      const r = await ingestText(rawText, title, metadata)
      console.log(`Source ID:   ${r.sourceId}`)
      console.log(`Chunk count: ${r.chunkCount}`)
      console.log(`Title:       ${r.title}`)
      break
    }

    case 'thesis': {
      const filepath = positional[0]
      if (!filepath) { console.error('thesis requires a filepath'); process.exit(1) }
      const thesisText = readFileSync(filepath, 'utf-8')
      const ids = await ingestThesis(thesisText)
      console.log(`Beliefs ingested: ${ids.length}`)
      ids.forEach((id, i) => console.log(`  [${i + 1}] ${id}`))
      break
    }

    case 'purge': {
      const count = await purgeExpiredCache()
      console.log(`Purged ${count} expired cache row(s)`)
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      console.error('Commands: pdf, youtube, text, thesis, purge')
      process.exit(1)
  }

  process.exit(0)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
