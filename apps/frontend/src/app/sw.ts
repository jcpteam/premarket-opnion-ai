// Service Worker for PWA offline functionality
const CACHE_NAME = 'prediction-market-v1';
const urlsToCache = [
  '/',
  '/markets',
  '/manifest.json',
];

self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event: any) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
