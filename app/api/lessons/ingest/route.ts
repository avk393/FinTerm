import { NextRequest, NextResponse } from 'next/server'
import { ingestThesis, ingestText, ingestYoutube } from '@/knowledge_table/ingestion/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      type: 'thesis' | 'academic' | 'youtube'
      text?: string
      title?: string
      url?: string
    }

    if (body.type === 'thesis') {
      if (!body.text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })
      const ids = await ingestThesis(body.text)
      return NextResponse.json({ ok: true, beliefIds: ids })
    }

    if (body.type === 'academic') {
      if (!body.text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })
      const title = body.title?.trim() || 'Untitled Paper'
      const result = await ingestText(body.text, title, {})
      return NextResponse.json({ ok: true, ...result })
    }

    if (body.type === 'youtube') {
      if (!body.url?.trim()) return NextResponse.json({ error: 'url is required' }, { status: 400 })
      const result = await ingestYoutube(body.url, {})
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
