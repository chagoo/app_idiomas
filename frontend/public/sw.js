const CACHE = 'app-idiomas-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/base_words.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE && caches.delete(k))))
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  event.respondWith(
    caches.match(req).then(res => res || fetch(req).then(networkRes => {
      const copy = networkRes.clone()
      caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {})
      return networkRes
    }).catch(() => res))
  )
})

