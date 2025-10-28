import React from 'react'

type Props = {
  themes: { name: string; count: number }[]
  selected: string | null
  onSelect: (theme: string) => void
}

export default function ThemeList({ themes, selected, onSelect }: Props) {
  return (
    <section>
      <h2>Listas tematicas</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {themes.map((t) => (
          <li key={t.name}>
            <button
              style={{
                width: '100%', textAlign: 'left', padding: '12px 16px',
                border: '1px solid #ddd', borderRadius: 8,
                background: selected === t.name ? '#e0f2fe' : 'white'
              }}
              onClick={() => onSelect(t.name)}
            >
              <strong>{t.name}</strong>
              <span style={{ color: '#555', marginLeft: 8 }}>({t.count})</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

