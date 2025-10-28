import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const el = document.getElementById('root')!
createRoot(el).render(<App />)

// Registrar service worker solo en build (produccion)
if ('serviceWorker' in navigator && import.meta.env.MODE === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
