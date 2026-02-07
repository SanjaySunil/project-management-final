import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/vite.svg', // Update with actual icon path
      badge: '/vite.svg',
      data: {
        link: data.data?.link
      }
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.notification.data?.link) {
    event.waitUntil(
      self.clients.openWindow(event.notification.data.link)
    )
  } else {
    event.waitUntil(
      self.clients.openWindow('/')
    )
  }
})
