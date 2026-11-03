// Pulled into the generated service worker (vite.config.ts importScripts). Shows a nudge, and opens its book on a tap.
self.addEventListener('push', event => {
  const nudge = event.data ? event.data.json() : { title: 'Margin', body: '', url: '/' }
  event.waitUntil(self.registration.showNotification(nudge.title, {
    body: nudge.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'margin-nudge', // a newer nudge replaces an unread one
    data: { url: nudge.url },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const open = windows.find(w => w.url.startsWith(self.location.origin))
    return open ? open.navigate(url).then(w => (w ?? open).focus()) : self.clients.openWindow(url)
  }))
})
