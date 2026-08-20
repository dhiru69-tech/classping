self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'ClassPing', body: 'Your class is starting soon.', url: '/' };
  try {
    data = event.data.json();
  } catch (e) {
    /* fall back to default above */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url },
      requireInteraction: true,
      tag: 'classping-reminder',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
