/* Service worker del DeCA: guarda la app en el teléfono para que abra al
   instante y funcione aunque no haya cobertura en el momento de arrancar.
   El código propio (index, app.js…) va siempre a la red y solo usa la copia
   guardada si no hay conexión, para que las mejoras lleguen solas. Las
   librerías de vendor/ y los PDFs de GitHub van aparte: nunca se cachean
   los datos que vienen de internet. */
'use strict';

const CACHE = 'deca-v3';
const SHELL = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'vendor/jspdf.umd.min.js',
  'vendor/qrcode.js',
  'vendor/tesseract.min.js',
  'vendor/tesseract-worker.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Solo se atiende lo propio; GitHub (API y PDFs) y el CDN del OCR van a la red.
  if (url.origin !== location.origin) return;

  // Los PDFs del QR NUNCA se tocan: la comprobación debe ver internet tal cual.
  // (Si se cachearan, una copia vieja podría tapar que el PDF aún no está publicado.)
  if (url.pathname.toLowerCase().endsWith('.pdf')) return;

  // Librerías de vendor/: no cambian nunca → primero la copia guardada.
  if (url.pathname.includes('/vendor/')) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(guardado => {
        const red = fetch(e.request).then(resp => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, copia));
          }
          return resp;
        }).catch(() => guardado);
        return guardado || red;
      })
    );
    return;
  }

  // El resto (la app): primero la red, y si no hay, lo guardado.
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp && resp.ok) {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return resp;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then(g => g || caches.match('./'))
    )
  );
});
