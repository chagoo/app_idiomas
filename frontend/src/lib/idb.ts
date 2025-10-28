const DB_NAME = 'app_idiomas'
const STORE = 'meta'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet<T = unknown>(db: IDBDatabase, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, key: IDBValidKey, val: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.put(val, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getXP(): Promise<number> {
  const db = await openDB()
  try {
    const val = await idbGet<number>(db, 'xp')
    return typeof val === 'number' ? val : 0
  } finally {
    db.close()
  }
}

export async function addXP(delta: number): Promise<number> {
  const db = await openDB()
  try {
    const current = await idbGet<number>(db, 'xp')
    const next = (typeof current === 'number' ? current : 0) + delta
    await idbPut(db, 'xp', next)
    return next
  } finally {
    db.close()
  }
}
