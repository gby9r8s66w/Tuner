/* Tuner — service worker: offline app shell, virtual manifest + icon */
const VERSION = 'tuner-v1';
const SHELL = ['./'];

const MANIFEST = {
  name: 'Tuner — RSS & Podcast Reader',
  short_name: 'Tuner',
  description: 'An offline-first reader that keeps articles and podcasts on one dial.',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#0d181f',
  theme_color: '#0d181f',
  icons: [
    { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
  ]
};

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#0d181f"/>
<g fill="none" stroke="#f0a63c" stroke-linecap="round">
<circle cx="256" cy="332" r="26" fill="#f0a63c" stroke="none"/>
<path d="M186 262a99 99 0 0 1 140 0" stroke-width="30"/>
<path d="M136 208a172 172 0 0 1 240 0" stroke-width="30" opacity=".72"/>
<path d="M86 154a245 245 0 0 1 340 0" stroke-width="30" opacity=".42"/>
</g></svg>`;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Virtual PWA files
  if (url.pathname.endsWith('/manifest.webmanifest')) {
    e.respondWith(new Response(JSON.stringify(MANIFEST),
      { headers: { 'Content-Type': 'application/manifest+json' } }));
    return;
  }
  if (url.pathname.endsWith('icon.svg')) {
    e.respondWith(new Response(ICON, { headers: { 'Content-Type': 'image/svg+xml' } }));
    return;
  }

  // App navigation: network-first, offline fallback to cached shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(VERSION).then(c => c.put('./', cp)).catch(() => {});
        return r;
      }).catch(() => caches.match('./'))
    );
    return;
  }

  // Same-origin assets: cache-first with revalidation
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      const cp = r.clone();
      caches.open(VERSION).then(c => c.put(req, cp));
      return r;
    })));
    return;
  }

  // Web fonts: cached so the app keeps its typography offline
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(VERSION + '-fonts').then(c =>
      c.match(req).then(hit => hit || fetch(req).then(r => {
        c.put(req, r.clone());
        return r;
      }))));
    return;
  }
  // Feed/audio requests fall through to the network (data lives in IndexedDB).
});
