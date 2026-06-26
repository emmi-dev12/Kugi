const CACHE = 'kugi-v17';
const PRECACHE = ['/', '/app', '/setup'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push from server (works when app is closed)
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'Kugi reminder', {
      body: data.body || '',
      tag: data.tag || 'kugi',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  );
});

// Notification click — focus or open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow('/app');
    })
  );
});

// In-app notification via postMessage (client-side fallback).
// Only accept messages from the same origin to prevent cross-origin notification injection.
self.addEventListener('message', e => {
  if (e.source && e.source.url && !e.source.url.startsWith(self.location.origin)) return;
  if (e.data?.type === 'NOTIFY') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });
  }
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;
  if (e.request.url.includes('convex.cloud')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
