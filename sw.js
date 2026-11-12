// Nobleza y valor · service worker
// Estrategia: red primero (siempre la versión más reciente si hay conexión) y copia local para usarla sin conexión.
const CACHE_VERSION = 'nyv-v16';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/vendor/chart.umd.js', 'manifest.webmanifest',
  'icons/escudo.png', 'icons/nyv-192.png', 'icons/nyv-512.png', 'icons/nyv-maskable-512.png', 'icons/nyv-apple-180.png', 'icons/nyv-favicon.png',
  'img/cabecera-2.jpg',
  'fonts/bebas-neue-latin-400-normal.woff2', 'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2', 'fonts/inter-latin-800-normal.woff2'];

self.addEventListener('install', e => {
  // cache: 'reload' evita copiar versiones antiguas guardadas por el navegador
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
