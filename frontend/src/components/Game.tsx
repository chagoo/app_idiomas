import React, { useEffect, useMemo, useState } from 'react'
import { Word } from '../lib/api'
import { addXP } from '../lib/idb'
import { syncXP } from '../lib/supabase'

type Props = {
  theme: string
  words: Word[]
  onXP?: (xp: number) => void
}

type Round = {
  question: Word
  options: string[] // Spanish options
  answer: string
}

function makeRound(pool: Word[]): Round | null {
  if (pool.length < 2) return null
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const question = shuffled[0]
  const distractors = shuffled.slice(1, 4).map(w => w.es)
  const options = [...distractors, question.es].sort(() => Math.random() - 0.5)
  return { question, options, answer: question.es }
}

export default function Game({ theme, words, onXP }: Props) {
  const [round, setRound] = useState<Round | null>(null)
  const [correct, setCorrect] = useState<number>(0)
  const [wrong, setWrong] = useState<number>(0)

  useEffect(() => {
    setRound(makeRound(words))
    setCorrect(0)
    setWrong(0)
  }, [theme, words])

  const pick = async (opt: string) => {
    if (!round) return
    if (opt === round.answer) {
      setCorrect(c => c + 1)
      const total = await addXP(10)
      await syncXP(total)
      onXP?.(total)
    } else {
      setWrong(w => w + 1)
    }
    setRound(makeRound(words))
  }

  if (!round) return <p>Se necesitan al menos 2 palabras para el juego.</p>

  return (
    <section>
      <h2>Juego: {theme}</h2>
      <div style={{ marginBottom: 8 }}>Aciertos: {correct} | Errores: {wrong}</div>
      <div style={{
        border: '1px solid #ddd', borderRadius: 12, padding: 24,
        display: 'grid', gap: 12, maxWidth: 520
      }}>
        <div style={{ fontSize: 40 }}>{round.question.image ?? '🎯'}</div>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{round.question.en}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {round.options.map((o) => (
            <button key={o} onClick={() => pick(o)} style={{ padding: 8 }}>{o}</button>
          ))}
        </div>
      </div>
    </section>
  )
}
