// Сначала сеть (с проверкой свежести у сервера, мимо HTTP-кэша), без сети — из кэша.
// Раньше отдавали кэш и обновляли его по файлу в фоне — новая страница смешивалась со старым app.js.
const CACHE = 'smeny-v2';
const FILES = ['./', 'index.html', 'app.js', 'calc.js', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

// shortcut: без тайм-аута — при очень медленной сети запуск ждёт её; если станет мешать, гонять сеть с кэшем наперегонки
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => {
        if (r.ok) { const copy = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy))); }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
