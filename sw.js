// Офлайн: сначала отдаём из кэша, в фоне обновляем. Новая версия на хостинге видна со второго запуска.
const CACHE = 'smeny';
const FILES = ['./', 'index.html', 'app.js', 'calc.js', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(e.request);
    const fresh = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (!cached) return fresh;
    e.waitUntil(fresh.catch(() => {}));
    return cached;
  }));
});
