const CACHE_NAME = 'lenamp-shell-v0.4.2-hotfix-platform-1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/lenamp.css',
  './css/splash.css',
  './css/dialog.css',
  './css/rating.css',
  './css/about.css',
  './js/config.js',
  './js/platform.js',
  './js/native-library.js',
  './js/native-audio.js',
  './js/viewport.js',
  './js/storage.js',
  './js/metadata.js',
  './js/media-session.js',
  './js/app.js',
  './js/splash.js',
  './js/rating.js',
  './js/about.js',
  './js/pwa.js',
  './assets/icons/lenamp-icon.png',
  './assets/icons/lenamp-icon-180.png',
  './assets/icons/lenamp-icon-192.png',
  './assets/icons/lenamp-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('lenamp-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    return caches.match(request);
  }
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request).then((response) => response || caches.match('./index.html')));
    return;
  }

  const freshCodeAsset = /\.(?:js|css|webmanifest)$/i.test(url.pathname);
  if (freshCodeAsset) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
