import React, { useEffect, useMemo, useState } from 'react'
import ThemeList from './components/ThemeList'
import Flashcards from './components/Flashcards'
import Game from './components/Game'
import LevelProgress from './components/LevelProgress'
import AdminBar from './components/AdminBar'
import AuthPanel from './components/AuthPanel'
import School from './components/School'
import Dino from './components/Dino'
import SchoolEditor from './components/SchoolEditor'
import type { Profile } from './lib/supabase'
import { checkConnection, diagnoseSupabase, isSupabaseConfigured, SupabaseDiagnostic, fetchRemoteXP } from './lib/supabase'
import { getThemes, getWords, Word } from './lib/api'
import { getXP } from './lib/idb'

type View = 'themes' | 'flashcards' | 'game' | 'progress' | 'school' | 'dino'

export default function App() {
  const [view, setView] = useState<View>('school')
  const [themes, setThemes] = useState<{ name: string; count: number }[]>([])
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [xp, setXp] = useState<number>(0)
  const [supaOn, setSupaOn] = useState<boolean>(false)
  const [supaDiag, setSupaDiag] = useState<SupabaseDiagnostic | null>(null)
  const [showDiag, setShowDiag] = useState<boolean>(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const isAdmin = !!profile && profile.role === 'admin'

  useEffect(() => {
    getThemes().then(setThemes)
    getXP().then(setXp)
    // Si hay XP remoto, sincronizar visualmente
    fetchRemoteXP().then((remote) => { if (typeof remote === 'number' && remote > 0) setXp(remote) })
    if (isSupabaseConfigured()) {
      diagnoseSupabase().then((d) => { setSupaOn(d.ok); setSupaDiag(d); if (!d.ok) setShowDiag(true) })
    } else { setSupaOn(false); const d = { configured: false, ok: false, stage: 'config', message: 'No configurado' } as SupabaseDiagnostic; setSupaDiag(d); setShowDiag(true) }
  }, [])

  useEffect(() => {
    if (selectedTheme) {
      getWords(selectedTheme).then(setWords)
    }
  }, [selectedTheme])

  const [showAuth, setShowAuth] = useState(false)

  const header = useMemo(() => (
    <header style={{
      padding: '12px 16px',
      background: '#0ea5e9', color: 'white',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      position: 'sticky', top: 0
    }}>
      <strong>App Idiomas</strong>
      <nav style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setView('school')}>Escuela</button>
        <button onClick={() => setView('themes')}>Temas</button>
        <button onClick={() => setView('flashcards')} disabled={!selectedTheme}>Flashcards</button>
        <button onClick={() => setView('game')} disabled={!selectedTheme}>Juego</button>
        <button onClick={() => setView('progress')}>Progreso</button>
        <button onClick={() => setView('dino')}>Dino</button>
      </nav>
      <button onClick={() => setShowDiag(v => !v)} title={supaOn ? 'Supabase conectado' : 'Supabase no configurado o sin conexion'} style={{
        marginLeft: 12,
        padding: '4px 8px',
        borderRadius: 999,
        background: supaOn ? '#22c55e' : '#64748b',
        color: 'white',
        fontSize: 12,
        border: 'none', cursor: 'pointer'
      }}>
        Supabase: {supaOn ? 'Conectado' : 'No' }
      </button>
      <button onClick={() => setShowAuth(v=>!v)} style={{ marginLeft: 8 }}>Autenticar</button>
    </header>
  ), [selectedTheme, supaOn])

  return (
    <div style={{ fontFamily: 'system-ui, Arial, sans-serif', maxWidth: 920, margin: '0 auto' }}>
      {header}
      <main style={{ padding: 16 }}>
        {showDiag && (
          <div style={{
            marginBottom: 12,
            padding: 12,
            border: '1px solid #e5e7eb', borderRadius: 8,
            background: '#f8fafc', color: '#0f172a'
          }}>
            <strong>Supabase:</strong> {supaDiag?.message ?? (supaOn ? 'Conectado' : 'No configurado')}
            {supaDiag?.code && <span> (HTTP {supaDiag.code})</span>}
            {!supaOn && (
              <div style={{ marginTop: 8, color: '#334155' }}>
                - Verifica `frontend/.env`: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
                <br />- Reinicia `npm run dev` tras cambios
                <br />- Si el error es 401/403, revisa RLS/policies de la tabla `progress`
                <br />- Si el error es 404, crea la tabla `progress`
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button onClick={() => diagnoseSupabase().then((d)=>{ setSupaOn(d.ok); setSupaDiag(d) })}>Reintentar diagnostico</button>
              <button style={{ marginLeft: 8 }} onClick={() => setShowDiag(false)}>Ocultar</button>
            </div>
          </div>
        )}
        {showAuth && (
          <AuthPanel visible={true} onAuthChange={setProfile} />
        )}
        {view === 'themes' && (
          <ThemeList
            themes={themes}
            selected={selectedTheme}
            onSelect={(t) => { setSelectedTheme(t); setView('flashcards') }}
          />
        )}
        {view === 'flashcards' && selectedTheme && (
          <Flashcards theme={selectedTheme} words={words} onXP={(v) => setXp(v)} />
        )}
        {view === 'game' && selectedTheme && (
          <Game theme={selectedTheme} words={words} onXP={(v) => setXp(v)} />
        )}
        {view === 'progress' && (
          <LevelProgress xp={xp} />
        )}
        {view === 'school' && (
          <>
            <School />
            {isAdmin && <SchoolEditor visible={true} />}
          </>
        )}
        {view === 'dino' && (
          <Dino />
        )}
        {view === 'admin' && (
          <AdminBar visible={supaOn && isAdmin} />
        )}
      </main>
    </div>
  )
}
