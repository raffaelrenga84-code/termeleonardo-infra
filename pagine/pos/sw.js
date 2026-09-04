/* sw.js — la pagina del POS resta apribile anche senza rete: i suoi file
   stanno in cache; le chiamate al server passano dirette (sono su un altro
   dominio) e, se falliscono, ci pensa la coda della pagina. */
const CACHE = 'pos-v2';
const FILE = ['/pos', '/pos/stato.js', '/pos/server.js', '/pos/pianta.js', '/pos/manifest.webmanifest', '/ingresso/icona-192.png', '/ingresso/icona-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;
  /* rete prima, cache se la rete manca: cosi' un aggiornamento arriva
     subito e senza rete la pagina si apre lo stesso */
  e.respondWith(
    fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/pos'))),
  );
});
