import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (URL && KEY) {
  try {
    client = createClient(URL, KEY)
  } catch (e) {
    client = null
  }
}

export function isSupabaseConfigured() {
  return !!client
}

export async function syncXP(xp: number) {
  if (!client) return
  try {
    // En un escenario real, se usaria el user_id autenticado
    // Aqui se guarda un registro unico (id fijo) por demostracion
    await client.from('progress').upsert({ id: 'local-user', xp })
  } catch {
    // silencioso si offline o falla
  }
}

export async function checkConnection(): Promise<boolean> {
  if (!URL || !KEY) return false
  try {
    const res = await fetch(`${URL}/auth/v1/health`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => ({} as any))
    return (data && (data.status === 'OK' || data.success === true))
  } catch {
    return false
  }
}

export type SupabaseDiagnostic = {
  configured: boolean
  ok: boolean
  stage?: 'config' | 'health' | 'rest'
  code?: number
  message: string
}

export async function diagnoseSupabase(): Promise<SupabaseDiagnostic> {
  if (!URL && !KEY) return { configured: false, ok: false, stage: 'config', message: 'Faltan URL y KEY en frontend/.env' }
  if (!URL) return { configured: false, ok: false, stage: 'config', message: 'Falta VITE_SUPABASE_URL' }
  if (!KEY) return { configured: false, ok: false, stage: 'config', message: 'Falta VITE_SUPABASE_ANON_KEY' }

  try {
    const h = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    if (!h.ok) return { configured: true, ok: false, stage: 'health', code: h.status, message: `Health fallo con HTTP ${h.status}` }
    // Intentar leer conteo de progress para validar RLS y REST
    const r = await fetch(`${URL}/rest/v1/progress?select=count`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: 'count=exact',
      },
    })
    if (r.ok) return { configured: true, ok: true, stage: 'rest', code: 200, message: 'Conectado' }
    if (r.status === 404) return { configured: true, ok: false, stage: 'rest', code: 404, message: 'Tabla progress no existe' }
    if (r.status === 401 || r.status === 403) return { configured: true, ok: false, stage: 'rest', code: r.status, message: 'RLS o clave no permite acceso (select)' }
    return { configured: true, ok: false, stage: 'rest', code: r.status, message: `REST devolvio HTTP ${r.status}` }
  } catch (e) {
    return { configured: true, ok: false, stage: 'rest', message: 'Error de red/CORS' }
  }
}

// Exponer cliente para otras funciones
export function getClient(): SupabaseClient | null { return client }

// Lectura de XP remoto para mostrar progreso
export async function fetchRemoteXP(): Promise<number | null> {
  if (!client) return null
  try {
    const { data, error } = await client.from('progress').select('xp').eq('id', 'local-user').single()
    if (error) return null
    return (data?.xp ?? null) as number | null
  } catch { return null }
}

// Consultas dinamicas para palabras/temas desde Supabase
export type SupaWord = { id: string; theme: string; en: string; es: string; image?: string; example?: string }

export async function supaFetchThemes(): Promise<{ name: string; count: number }[]> {
  if (!client) return []
  // Obtener lista y agrupar con RPC simple usando PostgREST: select=theme,count:theme
  // Nota: PostgREST no soporta count por columna directamente; usamos Prefer: count=exact y group by
  // Simplificamos: traemos todas las filas y contamos en cliente (dataset pequeño en demo).
  const { data, error } = await client.from('words').select('theme')
  if (error || !data) return []
  const counts: Record<string, number> = {}
  for (const row of data as any[]) {
    const t = String(row.theme)
    counts[t] = (counts[t] ?? 0) + 1
  }
  return Object.entries(counts).sort().map(([name, count]) => ({ name, count }))
}

export async function supaFetchWords(theme: string): Promise<SupaWord[]> {
  if (!client) return []
  const { data, error } = await client.from('words').select('*').ilike('theme', theme)
  if (error || !data) return []
  return data as SupaWord[]
}

export async function logReview(word_id: string, grade: number): Promise<void> {
  if (!client) return
  try {
    await client.from('reviews').insert({ user_id: 'local-user', word_id, grade })
  } catch { /* ignore */ }
}

// Auth helpers
export async function signUp(email: string, password: string) {
  if (!client) throw new Error('Supabase no configurado')
  return client.auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  if (!client) throw new Error('Supabase no configurado')
  return client.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  if (!client) throw new Error('Supabase no configurado')
  return client.auth.signOut()
}

export async function getUser() {
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data.user ?? null
}

export type Profile = { id: string; role: 'admin' | 'user' }
export async function getProfile(): Promise<Profile | null> {
  if (!client) return null
  const user = await getUser()
  if (!user) return null
  const { data, error } = await client.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
  if (error) return null
  return data as any
}

// Escuela: listas semanales
export type SchoolItem = {
  id?: string
  week: string
  kind: 'pattern' | 'review'
  idx: number
  word: string
  sentence?: string | null
  es?: string | null
}

export async function getSchoolWeeks(): Promise<string[]> {
  if (!client) return []
  const { data } = await client.from('school_items').select('week').order('week')
  const set = new Set<string>((data ?? []).map((r: any) => r.week))
  return Array.from(set)
}

export async function getSchoolItems(week: string): Promise<SchoolItem[]> {
  if (!client) return []
  const { data } = await client
    .from('school_items')
    .select('*')
    .eq('week', week)
    .order('kind')
    .order('idx')
  return (data ?? []) as SchoolItem[]
}

export async function upsertSchoolItems(items: SchoolItem[]): Promise<void> {
  if (!client) throw new Error('Supabase no configurado')
  // Usamos clave natural (week,kind,idx) para evitar duplicados
  const { error } = await client
    .from('school_items')
    .upsert(items, { onConflict: 'week,kind,idx', returning: 'minimal' as any })
  if (error) throw error
}
