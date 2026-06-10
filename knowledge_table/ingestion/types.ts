export type SourceType = 'pdf' | 'youtube' | 'thesis' | 'manual'

export interface ChunkMetadata {
  tickers: string[]
  sector: string
  [key: string]: unknown
}

export interface BeliefSignal {
  field: string
  op: '>' | '<' | '>=' | '<=' | '==' | '!='
  value: number | string | boolean
}

export interface ThesisBelief {
  belief: string
  category: string
  signals: BeliefSignal[]
}

export interface IngestionResult {
  sourceId: string
  chunkCount: number
  title: string
}
