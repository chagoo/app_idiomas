import React from 'react'

export default function LevelProgress({ xp }: { xp: number }) {
  const level = Math.floor(xp / 100) + 1
  const current = xp % 100
  return (
    <section>
      <h2>Progreso</h2>
      <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, maxWidth: 520 }}>
        <div>Nivel: <strong>{level}</strong></div>
        <div style={{ marginTop: 8 }}>XP: {xp}</div>
        <div style={{ marginTop: 8, background: '#eee', height: 12, borderRadius: 6 }}>
          <div style={{ width: `${current}%`, height: '100%', background: '#0ea5e9', borderRadius: 6 }} />
        </div>
        <small style={{ color: '#555' }}>Proximo nivel en {100 - current} XP</small>
      </div>
    </section>
  )
}

