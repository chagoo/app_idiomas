import React, { useEffect, useMemo, useState } from 'react'
import { Word, review } from '../lib/api'
import { addXP } from '../lib/idb'
import { syncXP, logReview } from '../lib/supabase'

type Props = {
  theme: string
  words: Word[]
  onXP?: (xp: number) => void
}

export default function Flashcards({ theme, words, onXP }: Props) {
  const [queue, setQueue] = useState<Word[]>([])
  const [current, setCurrent] = useState<Word | null>(null)

  useEffect(() => {
    const shuffled = [...words].sort(() => Math.random() - 0.5)
    setQueue(shuffled)
    setCurrent(shuffled[0] ?? null)
  }, [theme, words])

  const handleGrade = async (grade: 0 | 1 | 2 | 3) => {
    if (!current) return
    // Backend (si disponible) o local
    await review(current.id, grade)
    // Registrar review en Supabase si esta configurado
    await logReview(current.id, grade)
    // Gana XP simple: 5/8/10/15
    const gain = [5, 8, 10, 15][grade]
    const total = await addXP(gain)
    // Sincronizar con Supabase si esta configurado
    await syncXP(total)
    onXP?.(total)

    // Siguiente tarjeta: mover actuales al final si Again/Hard
    const rest = queue.slice(1)
    if (grade <= 1) {
      setQueue([...rest, current])
      setCurrent(rest[0] ?? current)
    } else {
      setQueue(rest)
      setCurrent(rest[0] ?? null)
    }
  }

  if (!current) return <p>No hay mas tarjetas en este tema.</p>

  return (
    <section>
      <h2>Flashcards: {theme}</h2>
      <div style={{
        border: '1px solid #ddd', borderRadius: 12, padding: 24,
        display: 'grid', gap: 12, maxWidth: 520
      }}>
        <div style={{ fontSize: 48 }}>{current.image ?? '🧠'}</div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{current.en}</div>
          <div style={{ color: '#555', marginTop: 4 }}>{current.es}</div>
          {current.example && (
            <div style={{ marginTop: 8, color: '#333' }}>
              <em>{current.example}</em>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <button onClick={() => handleGrade(0)}>Again</button>
          <button onClick={() => handleGrade(1)}>Hard</button>
          <button onClick={() => handleGrade(2)}>Good</button>
          <button onClick={() => handleGrade(3)}>Easy</button>
        </div>
      </div>
    </section>
  )
}
