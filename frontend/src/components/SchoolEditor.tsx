import React, { useMemo, useState } from 'react'
import { SchoolItem, upsertSchoolItems } from '../lib/supabase'

type Props = { visible: boolean }

function parseList(raw: string, week: string): SchoolItem[] {
  // Formato por linea:
  //   word
  //   word | sentence
  //   word | sentence | es
  // Seccionadas por encabezados **Pattern Words:** y **Review Words:**
  const lines = raw.split(/\r?\n/)
  let kind: 'pattern' | 'review' = 'pattern'
  const items: SchoolItem[] = []
  let idx = 1
  for (const ln of lines) {
    const t = ln.trim()
    if (!t) continue
    if (/\*\*?\s*Pattern/i.test(t)) { kind = 'pattern'; idx = 1; continue }
    if (/\*\*?\s*Review/i.test(t)) { kind = 'review'; idx = 1; continue }
    // quitar numeracion "1." si existe
    const m = t.match(/^\d+\.?\s*(.*)$/)
    const body = (m ? m[1] : t)
    const parts = body.split('|').map(s => s?.trim() ?? '')
    const word = parts[0]
    const sentence = parts[1] || ''
    const es = parts[2] || ''
    if (!word) continue
    items.push({ week, kind, idx, word, sentence: sentence || null, es: es || null })
    idx++
  }
  return items
}

export default function SchoolEditor({ visible }: Props) {
  const [week, setWeek] = useState('Lesson 8')
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  if (!visible) return null

  const doSave = async () => {
    setBusy(true); setMsg('')
    try {
      const items = parseList(raw, week)
      if (!items.length) { setMsg('Nada que guardar.'); setBusy(false); return }
      await upsertSchoolItems(items)
      setMsg(`Guardado ${items.length} items para ${week}`)
    } catch (e: any) {
      setMsg(e?.message ?? 'Error guardando')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3>Escuela · Editor (admin)</h3>
      <div style={{ display: 'grid', gap: 8, maxWidth: 760 }}>
        <div>
          <label>Semana/Leccion:&nbsp;</label>
          <input value={week} onChange={e=>setWeek(e.target.value)} placeholder="Lesson 8" />
        </div>
        <textarea value={raw} onChange={e=>setRaw(e.target.value)} rows={10} placeholder={"Pega tu lista aqui.\nUsa encabezados '**Pattern Words:**' y '**Review Words:**'.\nFormato por linea: 'palabra | oracion (opcional)'."} />
        <div>
          <button onClick={doSave} disabled={busy}>{busy ? 'Guardando...' : 'Guardar lista'}</button>
          {msg && <span style={{ marginLeft: 8 }}>{msg}</span>}
        </div>
      </div>
    </section>
  )
}
