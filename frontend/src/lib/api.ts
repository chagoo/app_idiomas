export type Word = {
  id: string
  theme: string
  en: string
  es: string
  image?: string
  example?: string
}

const API = import.meta.env.VITE_API_BASE as string | undefined
import { isSupabaseConfigured, supaFetchThemes, supaFetchWords } from './supabase'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getThemes(): Promise<{ name: string; count: number }[]> {
  // Prioridad: Supabase si esta configurado -> backend -> local
  if (isSupabaseConfigured()) {
    const rows = await supaFetchThemes()
    if (rows.length) return rows
  }
  if (API) return fetchJSON(`${API}/themes/`)
  // Fallback local: agrupar por tema
  const words: Word[] = await fetchJSON('/base_words.json')
  const counts: Record<string, number> = {}
  for (const w of words) counts[w.theme] = (counts[w.theme] ?? 0) + 1
  return Object.entries(counts).sort().map(([name, count]) => ({ name, count }))
}

export async function getWords(theme: string): Promise<Word[]> {
  if (isSupabaseConfigured()) {
    const rows = await supaFetchWords(theme)
    if (rows.length) return rows as Word[]
  }
  if (API) return fetchJSON(`${API}/themes/${encodeURIComponent(theme)}/words`)
  const words: Word[] = await fetchJSON('/base_words.json')
  return words.filter(w => w.theme.toLowerCase() === theme.toLowerCase())
}

export async function review(word_id: string, grade: 0 | 1 | 2 | 3): Promise<void> {
  if (!API) return
  try {
    await fetch(`${API}/srs/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_id, grade })
    })
  } catch {
    // offline o backend caido; ignorar
  }
}
