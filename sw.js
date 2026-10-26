/* Ferduqui — guarda la app en el cel para que abra sin internet.
   Cuando cambies cualquier archivo, sube el número de VERSION
   para que los cels descarguen la versión nueva. */
const VERSION = 'ferduqui-v4';
const ARCHIVOS = [
  './',
  'index.html',
  'estilos.css',
  'app.js',
  'manifest.json',
  'fuentes/fredoka.woff2',
  'fuentes/nunito.woff2',
  'iconos/icono.svg',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/apple-touch-icon.png',
  'iconos/favicon-64.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero lo guardado (abre al instante y sin internet); en segundo plano se actualiza.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Google Apps Script y demás: directo a internet
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const guardado = await cache.match(req, { ignoreSearch: true });
      const deRed = fetch(req)
        .then(r => { if (r.ok) cache.put(req, r.clone()); return r; })
        .catch(() => null);
      if (guardado) { e.waitUntil(deRed); return guardado; }
      const r = await deRed;
      if (r) return r;
      if (req.mode === 'navigate') return cache.match('index.html');
      return new Response('', { status: 504 });
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    })
  );
});
