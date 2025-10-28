# app_idiomas

Aplicacion para aprender ingles con listas tematicas, memorizacion visual, un minijuego, soporte offline y preparacion para sincronizar niveles con Supabase.

## Estructura

- `backend/` FastAPI con endpoints de temas, palabras y SRS. Carga una lista base offline y hooks para Supabase.
- `frontend/` React + Vite con PWA (offline), flashcards, juego y progreso local. Hooks opcionales para Supabase.

## Requisitos rapidos

- Python 3.10+
- Node.js 18+

## Backend (desarrollo)

```
cd backend
python -m venv .venv && .\\.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Endpoints principales:
- `GET /themes` lista de temas.
- `GET /themes/{theme}/words` palabras por tema.
- `POST /srs/review` registra resultado de repaso y devuelve proxima tarjeta.

Configurar Supabase (opcional): copiar `backend/.env.example` a `.env` y rellenar `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

## Frontend (desarrollo)

```
cd frontend
npm install
npm run dev
```

Se sirve en `http://localhost:5173`. Funciona offline (PWA). Por defecto usa datos locales (`public/base_words.json`).

Para apuntar al backend local, crear `.env` en `frontend/` con:
```
VITE_API_BASE=http://localhost:8000
```

Supabase (opcional) en `frontend/.env`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Construccion y distribucion

- Frontend: `npm run build` genera `frontend/dist/` (PWA). Puede servirse estaticamente.
- Backend: ejecutar con Uvicorn/Gunicorn. Puede servir `dist/` como estaticos si se desea.

## Offline

- Base de palabras: `backend/data/base_words.json` y `frontend/public/base_words.json`.
- Cache PWA via `public/sw.js` y `manifest.webmanifest`.

## Notas

- Este repo es un scaffold funcional. Integraremos logica/UX adicional segun feedback.
