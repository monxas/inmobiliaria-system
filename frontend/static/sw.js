/**
 * Service Worker for Push Notifications
 * Inmobiliaria System - Mobile Agent Push
 */

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag || 'inmobiliaria',
    data: {
      url: data.url || '/dashboard',
      ...data.data,
    },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Inmobiliaria', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

// Background sync for queued messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-messages') {
    event.waitUntil(sendQueuedMessages())
  }
})

async function sendQueuedMessages() {
  // Get queued messages from IndexedDB and send them
  // This handles offline → online message sending
  try {
    const db = await openDB()
    const tx = db.transaction('outbox', 'readonly')
    const store = tx.objectStore('outbox')
    const messages = await getAllFromStore(store)
    
    for (const msg of messages) {
      try {
        await fetch('/api/communications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.data),
        })
        // Remove from outbox on success
        const deleteTx = db.transaction('outbox', 'readwrite')
        deleteTx.objectStore('outbox').delete(msg.id)
      } catch {
        // Will retry on next sync
      }
    }
  } catch {
    // IndexedDB not available
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('inmobiliaria-offline', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
