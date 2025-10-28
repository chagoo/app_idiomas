import React, { useState } from 'react'
import { migrateLocalWordsToSupabase, MigrationReport } from '../lib/migrate'

export default function AdminBar({ visible }: { visible: boolean }) {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<MigrationReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!visible) return null

  const run = async () => {
    setBusy(true); setError(null); setReport(null)
    try {
      const r = await migrateLocalWordsToSupabase()
      setReport(r)
    } catch (e: any) {
      setError(e?.message ?? 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      marginBottom: 12,
      padding: 12,
      border: '1px dashed #94a3b8', borderRadius: 8,
      background: '#f1f5f9', color: '#0f172a'
    }}>
      <strong>Herramientas (Admin local)</strong>
      <div style={{ marginTop: 8 }}>
        <button onClick={run} disabled={busy}>
          {busy ? 'Migrando...' : 'Migrar palabras locales → Supabase'}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 8, color: '#b91c1c' }}>
          {error}
          <div style={{ color: '#334155' }}>
            - Asegura que la tabla `words` existe y que `anon` tiene permiso INSERT
            (policy: for insert to anon with check (true); y GRANT insert)
          </div>
        </div>
      )}
      {report && (
        <div style={{ marginTop: 8, color: '#065f46' }}>
          Completado: {report.inserted}/{report.total}. Errores: {report.failed}
          {report.errors.length > 0 && (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{report.errors.join('\n')}</pre>
          )}
        </div>
      )}
    </div>
  )
}

