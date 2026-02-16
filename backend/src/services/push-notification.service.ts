/**
 * @fileoverview Web Push Notification Service
 * Handles subscription management and push delivery
 */

import { container } from '../lib/container'
import { logger } from '../lib/logger'

// =============================================================================
// Types
// =============================================================================

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string       // Click action URL
  tag?: string        // Group notifications
  data?: Record<string, unknown>
}

interface PushResult {
  success: boolean
  endpoint: string
  error?: string
}

// =============================================================================
// VAPID Configuration
// =============================================================================

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@inmobiliaria.local'

  if (!publicKey || !privateKey) {
    logger.warn('VAPID keys not configured - push notifications disabled')
    return null
  }
  return { publicKey, privateKey, subject }
}

// =============================================================================
// Push Service
// =============================================================================

/**
 * Save a push subscription for a user
 */
export async function saveSubscription(
  userId: number,
  subscription: PushSubscription,
  deviceName?: string,
  userAgent?: string
): Promise<void> {
  const db = container.getDatabase()
  await db`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key, device_name, user_agent, last_used_at)
    VALUES (${userId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, 
            ${deviceName || null}, ${userAgent || null}, NOW())
    ON CONFLICT (endpoint) DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth_key = EXCLUDED.auth_key,
      user_agent = EXCLUDED.user_agent,
      is_active = true,
      last_used_at = NOW(),
      updated_at = NOW()
  `
}

/**
 * Remove a push subscription
 */
export async function removeSubscription(endpoint: string): Promise<void> {
  const db = container.getDatabase()
  await db`UPDATE push_subscriptions SET is_active = false, updated_at = NOW() WHERE endpoint = ${endpoint}`
}

/**
 * Send push notification to a specific user (all their devices)
 */
export async function sendToUser(userId: number, payload: PushPayload): Promise<PushResult[]> {
  const vapid = getVapidKeys()
  if (!vapid) return [{ success: false, endpoint: '', error: 'VAPID not configured' }]

  const db = container.getDatabase()
  const subs = await db`
    SELECT endpoint, p256dh, auth_key FROM push_subscriptions 
    WHERE user_id = ${userId} AND is_active = true
  `

  if (subs.length === 0) {
    return [{ success: false, endpoint: '', error: 'No active subscriptions' }]
  }

  const results: PushResult[] = []
  
  for (const sub of subs) {
    try {
      const webpush = await import('web-push')
      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

      const subscription = {
        endpoint: sub.endpoint as string,
        keys: {
          p256dh: sub.p256dh as string,
          auth: sub.auth_key as string,
        },
      }

      await webpush.sendNotification(subscription, JSON.stringify(payload))
      results.push({ success: true, endpoint: sub.endpoint as string })

      // Update last used
      await db`UPDATE push_subscriptions SET last_used_at = NOW() WHERE endpoint = ${sub.endpoint}`
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      
      // If subscription expired/invalid, deactivate it
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        await db`UPDATE push_subscriptions SET is_active = false WHERE endpoint = ${sub.endpoint}`
      }
      
      results.push({ success: false, endpoint: sub.endpoint as string, error: errMsg })
    }
  }

  return results
}

/**
 * Get VAPID public key for client-side subscription
 */
export function getPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}

/**
 * Get subscription count for a user
 */
export async function getSubscriptionCount(userId: number): Promise<number> {
  const db = container.getDatabase()
  const rows = await db`
    SELECT COUNT(*) as count FROM push_subscriptions 
    WHERE user_id = ${userId} AND is_active = true
  `
  return Number(rows[0]?.count || 0)
}
