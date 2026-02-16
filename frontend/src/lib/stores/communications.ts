/**
 * Communications Store
 * Manages WhatsApp status, push subscriptions, and messaging
 */

import { writable, derived } from 'svelte/store'
import { apiClient } from '../api/client'

// =============================================================================
// Types
// =============================================================================

interface WhatsAppStatus {
  connected: boolean
  phoneNumber?: string
  qrCode?: string
  state: 'disconnected' | 'connecting' | 'qr_pending' | 'connected' | 'error'
  lastError?: string
}

interface CommunicationLog {
  id: number
  client_id: number
  channel: string
  type: string
  message: string
  status: string
  created_at: string
  client_name?: string
  recipient_phone?: string
  recipient_email?: string
}

interface CommStats {
  last30Days: { byChannel: Record<string, number>; byStatus: Record<string, number> }
  last24Hours: number
  whatsappStatus: WhatsAppStatus
}

// =============================================================================
// Stores
// =============================================================================

export const whatsappStatus = writable<WhatsAppStatus>({ connected: false, state: 'disconnected' })
export const communicationLogs = writable<CommunicationLog[]>([])
export const commStats = writable<CommStats | null>(null)
export const pushEnabled = writable(false)
export const pushSupported = writable(false)

// =============================================================================
// Actions
// =============================================================================

export async function fetchWhatsAppStatus(): Promise<void> {
  try {
    const res = await apiClient.get('/communications/whatsapp/status')
    if (res.success) whatsappStatus.set(res.data)
  } catch { /* silent */ }
}

export async function initializeWhatsApp(): Promise<void> {
  await apiClient.post('/communications/whatsapp/initialize')
  // Poll for QR code
  setTimeout(fetchWhatsAppStatus, 2000)
}

export async function disconnectWhatsApp(): Promise<void> {
  await apiClient.post('/communications/whatsapp/disconnect')
  whatsappStatus.set({ connected: false, state: 'disconnected' })
}

export async function fetchWhatsAppQR(): Promise<string | null> {
  const res = await apiClient.get('/communications/whatsapp/qr')
  if (res.success && res.data.qr) {
    return res.data.qr
  }
  return null
}

export async function sendMessage(params: {
  clientId?: number
  recipientPhone?: string
  message?: string
  templateName?: string
  templateData?: Record<string, string | number>
  type?: string
  channels?: string[]
}): Promise<{ success: boolean; channel?: string; error?: string }> {
  const res = await apiClient.post('/communications/send', {
    ...params,
    customMessage: params.message,
  })
  return res.success ? res.data : { success: false, error: 'Send failed' }
}

export async function sendQuickWhatsApp(clientId: number, message: string): Promise<{ success: boolean }> {
  const res = await apiClient.post('/communications/send-quick', { clientId, message })
  return { success: res.success }
}

export async function fetchHistory(filters?: { clientId?: number; channel?: string; limit?: number }): Promise<void> {
  const params = new URLSearchParams()
  if (filters?.clientId) params.set('clientId', String(filters.clientId))
  if (filters?.channel) params.set('channel', filters.channel)
  if (filters?.limit) params.set('limit', String(filters.limit))

  const res = await apiClient.get(`/communications/history?${params}`)
  if (res.success) communicationLogs.set(res.data.logs)
}

export async function fetchClientComms(clientId: number): Promise<any> {
  const res = await apiClient.get(`/communications/client/${clientId}`)
  return res.success ? res.data : null
}

export async function fetchStats(): Promise<void> {
  const res = await apiClient.get('/communications/stats')
  if (res.success) commStats.set(res.data)
}

// =============================================================================
// Push Notifications
// =============================================================================

export async function checkPushSupport(): Promise<boolean> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window
  pushSupported.set(supported)
  return supported
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    // Get VAPID public key
    const keyRes = await apiClient.get('/communications/push/vapid-key')
    if (!keyRes.success || !keyRes.data.publicKey) return false

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey),
    })

    // Send subscription to backend
    const subJson = subscription.toJSON()
    await apiClient.post('/communications/push/subscribe', {
      subscription: {
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys!.p256dh, auth: subJson.keys!.auth },
      },
      deviceName: getDeviceName(),
    })

    pushEnabled.set(true)
    return true
  } catch (err) {
    console.error('Push subscription failed:', err)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  if (registration) {
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await apiClient.delete('/communications/push/subscribe', {
        endpoint: subscription.endpoint,
      })
      await subscription.unsubscribe()
    }
  }
  pushEnabled.set(false)
}

export async function testPush(): Promise<void> {
  await apiClient.post('/communications/push/test')
}

// =============================================================================
// Calendar Export
// =============================================================================

export async function getCalendarFeedUrl(): Promise<{ feedUrl: string; instructions: Record<string, string> } | null> {
  const res = await apiClient.get('/communications/calendar/feed-url')
  return res.success ? res.data : null
}

export async function downloadEventICS(eventId: string): Promise<void> {
  const response = await fetch(`/api/communications/calendar/export/${eventId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  if (response.ok) {
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `event-${eventId}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }
}

// =============================================================================
// Helpers
// =============================================================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function getDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Unknown Device'
}
