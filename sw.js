// ══════════════════════════════════════════════════════
//  Service Worker – Turni Ivan Magon PWA
//  Strategia: Cache-First con Network Fallback
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'turni-ivan-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-96.png',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: pre-cache tutti i file dell'app ──────────
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: pulisce cache vecchie ──────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache-First per assets locali ─────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Per richieste esterne (es. Google Sheets CSV import)
  // usa sempre la rete senza cache
  if (!url.pathname.match(/\.(html|json|png|js|css)$/)) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Per gli asset dell'app: Cache-First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // In background aggiorna la cache (stale-while-revalidate)
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {});
        return cached;
      }
      // Non in cache: scarica dalla rete e metti in cache
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

// ── MESSAGE: permette aggiornamento forzato ───────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
