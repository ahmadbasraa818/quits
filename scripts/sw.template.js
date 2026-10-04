/* global self, caches, fetch, URL */
// The service worker for the web build. scripts/postexport.mjs fills in the
// version and the files to keep, and writes it to dist/sw.js.

const VERSION = '__VERSION__';
const BASE = '/quits/';
const FILES = __FILES__;
const CACHE = `quits-${VERSION}`;

// Keep a copy of every file of this version, then take over straight away.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

// Drop the copies older versions kept.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('quits-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Exchange rates, and anything else not the app's own, go straight to the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    // Pages come from the network first, so a new version shows as soon as it's deployed;
    // without a connection, the app this worker kept opens instead.
    event.respondWith(fetch(request).catch(() => caches.match(BASE)));
    return;
  }
  // Every other file is named for its version, so the kept copy is the right one.
  event.respondWith(caches.match(request).then((kept) => kept || fetch(request)));
});
