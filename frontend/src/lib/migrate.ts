import { getClient } from './supabase'
import type { Word } from './api'

export type MigrationReport = {
  total: number
  inserted: number
  failed: number
  errors: string[]
}

async function chunks<T>(arr: T[], size = 500): Promise<T[][]> {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function migrateLocalWordsToSupabase(): Promise<MigrationReport> {
  const client = getClient()
  if (!client) throw new Error('Supabase no configurado')

  const words: Word[] = await fetch('/base_words.json').then(r => r.json())
  const batches = await chunks(words, 500)
  let inserted = 0
  const errors: string[] = []

  for (const batch of batches) {
    const { error, count } = await client
      .from('words')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false, count: 'exact' as any, returning: 'minimal' as any })

    if (error) {
      errors.push(`${error.code ?? ''} ${error.message}`.trim())
    } else {
      inserted += batch.length
    }
  }

  return { total: words.length, inserted, failed: errors.length, errors }
}
