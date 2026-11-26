const CACHE_NAME = 'homework-list-cache-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const EXTERNAL_CACHE_ORIGINS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://www.gstatic.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url))
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isSameOrigin = url.startsWith(self.location.origin);
  const isAllowedExternal = EXTERNAL_CACHE_ORIGINS.some((origin) => url.startsWith(origin));

  if (!isSameOrigin && !isAllowedExternal) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone).catch(() => {}));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && (response.status === 200 || response.type === 'opaque')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

// Handle Push Events from Server (FCM / OneSignal / Web Push)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Homework List — แจ้งเตือนกำหนดส่งงาน',
    body: 'ตรวจสอบรายการการบ้านที่ใกล้ครบกำหนดส่ง',
    tag: 'homework-list-push'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: './icon-192.png',
      badge: './icon-192.png',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: './index.html' }
    })
  );
});

// Handle Messages from Main App (Client -> SW showNotification for Android & iOS PWA)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'Homework List', {
        body: body || '',
        tag: tag || 'homework-list-local',
        icon: './icon-192.png',
        badge: './icon-192.png',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: './index.html' }
      })
    );
  }
});

// Focus or Open App when Notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
