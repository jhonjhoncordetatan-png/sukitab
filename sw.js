const CACHE_NAME = 'sukitab-pos-v13';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
const OFFLINE_CDN_ASSETS = [
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try { await cache.addAll(SHELL_ASSETS); } catch (e) {}
      for (const cdnUrl of OFFLINE_CDN_ASSETS) {
        try {
          const resp = await fetch(cdnUrl, { mode: 'cors' });
          if (resp && resp.ok) await cache.put(cdnUrl, resp);
        } catch (e) {}
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never intercept Google Apps Script API POST calls
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Cache-first for SheetJS Excel library so .xlsx export & Messenger sharing work 100% offline
  if (url.href.indexOf('cdn.sheetjs.com') !== -1) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        });
      })
    );
    return;
  }

  // Only cache same-origin app shell files (GitHub Pages)
  if (url.origin !== self.location.origin) return;

  // Network-first for GitHub Pages updates, instant cache fallback when offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
