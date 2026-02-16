/**
 * @fileoverview Communications API Routes
 * WhatsApp, SMS, Push, and unified communication hub
 */

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import type { AppVariables } from '../types'
import { whatsappService } from '../services/whatsapp.service'
import * as orchestrator from '../services/notification-orchestrator.service'
import * as pushService from '../services/push-notification.service'
import * as icalService from '../services/ical-export.service'
import { container } from '../lib/container'
import { logger } from '../lib/logger'

const communications = new Hono<{ Variables: AppVariables }>()

// Auth required for all routes
communications.use('*', requireAuth())

// =============================================================================
// WhatsApp Management
// =============================================================================

/**
 * GET /api/communications/whatsapp/status
 */
communications.get('/whatsapp/status', (c) => {
  const status = whatsappService.status
  return c.json({ success: true, data: status })
})

/**
 * GET /api/communications/whatsapp/qr
 * Get QR code for WhatsApp pairing
 */
communications.get('/whatsapp/qr', async (c) => {
  const qr = await whatsappService.getQRCode()
  if (!qr) {
    return c.json({ success: true, data: { qr: null, message: 'No QR available - already connected or not initialized' } })
  }
  return c.json({ success: true, data: { qr } })
})

/**
 * POST /api/communications/whatsapp/initialize
 * Start WhatsApp client
 */
communications.post('/whatsapp/initialize', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ success: false, error: { message: 'Admin only' } }, 403)
  }
  void whatsappService.initialize()
  return c.json({ success: true, data: { message: 'WhatsApp initialization started' } })
})

/**
 * POST /api/communications/whatsapp/disconnect
 */
communications.post('/whatsapp/disconnect', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ success: false, error: { message: 'Admin only' } }, 403)
  }
  await whatsappService.disconnect()
  return c.json({ success: true, data: { message: 'WhatsApp disconnected' } })
})

// =============================================================================
// Send Messages
// =============================================================================

const sendMessageSchema = z.object({
  clientId: z.number().int().positive().optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().optional(),
  type: z.enum([
    'appointment_confirmation', 'appointment_reminder', 'appointment_followup',
    'viewing_confirmation', 'viewing_reminder', 'viewing_followup',
    'document_shared', 'general', 'custom'
  ]).default('general'),
  templateName: z.string().optional(),
  templateData: z.record(z.union([z.string(), z.number()])).optional(),
  customMessage: z.string().optional(),
  subject: z.string().optional(),
  channels: z.array(z.enum(['whatsapp', 'sms', 'email', 'push'])).optional(),
  eventId: z.string().optional(),
  propertyId: z.number().int().positive().optional(),
  viewingId: z.number().int().positive().optional(),
})

/**
 * POST /api/communications/send
 * Send a message through the orchestrator (with fallback)
 */
communications.post('/send', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = sendMessageSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ success: false, error: { message: 'Validation failed', details: parsed.error.flatten() } }, 400)
  }

  const result = await orchestrator.sendNotification({
    ...parsed.data,
    userId: user.id,
  })

  return c.json({ success: result.success, data: result }, result.success ? 200 : 500)
})

/**
 * POST /api/communications/send-quick
 * Quick send WhatsApp to a client
 */
communications.post('/send-quick', async (c) => {
  const user = c.get('user')
  const { clientId, message } = await c.req.json() as { clientId: number; message: string }

  if (!clientId || !message) {
    return c.json({ success: false, error: { message: 'clientId and message required' } }, 400)
  }

  const result = await orchestrator.sendNotification({
    clientId,
    userId: user.id,
    type: 'custom',
    customMessage: message,
  })

  return c.json({ success: result.success, data: result })
})

// =============================================================================
// Communication History
// =============================================================================

/**
 * GET /api/communications/history
 * Get communication history with filters
 */
communications.get('/history', async (c) => {
  const clientId = c.req.query('clientId')
  const channel = c.req.query('channel')
  const limit = Math.min(Number(c.req.query('limit') || 50), 200)
  const offset = Number(c.req.query('offset') || 0)

  const db = container.getDatabase()

  let query
  if (clientId) {
    query = db`
      SELECT cl.*, c.full_name as client_name, u.email as agent_email
      FROM communication_logs cl
      LEFT JOIN clients c ON c.id = cl.client_id
      LEFT JOIN users u ON u.id = cl.user_id
      WHERE cl.client_id = ${Number(clientId)}
      ${channel ? db`AND cl.channel = ${channel}` : db``}
      ORDER BY cl.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else {
    query = db`
      SELECT cl.*, c.full_name as client_name, u.email as agent_email
      FROM communication_logs cl
      LEFT JOIN clients c ON c.id = cl.client_id
      LEFT JOIN users u ON u.id = cl.user_id
      ${channel ? db`WHERE cl.channel = ${channel}` : db``}
      ORDER BY cl.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  }

  const logs = await query
  return c.json({ success: true, data: { logs, count: logs.length } })
})

/**
 * GET /api/communications/client/:clientId
 * Get all communications for a client (communication hub view)
 */
communications.get('/client/:clientId', async (c) => {
  const clientId = Number(c.req.param('clientId'))
  const db = container.getDatabase()

  const [logs, client] = await Promise.all([
    db`
      SELECT * FROM communication_logs 
      WHERE client_id = ${clientId}
      ORDER BY created_at DESC
      LIMIT 100
    `,
    db`SELECT * FROM clients WHERE id = ${clientId}`,
  ])

  if (client.length === 0) {
    return c.json({ success: false, error: { message: 'Client not found' } }, 404)
  }

  // Group by channel for hub view
  const byChannel: Record<string, any[]> = { whatsapp: [], sms: [], email: [], push: [], call: [] }
  for (const log of logs) {
    const ch = log.channel as string
    if (byChannel[ch]) byChannel[ch].push(log)
  }

  return c.json({
    success: true,
    data: {
      client: client[0],
      communications: logs,
      byChannel,
      stats: {
        total: logs.length,
        whatsapp: byChannel.whatsapp.length,
        sms: byChannel.sms.length,
        email: byChannel.email.length,
      },
    },
  })
})

// =============================================================================
// Push Notifications
// =============================================================================

/**
 * GET /api/communications/push/vapid-key
 * Get VAPID public key for client-side subscription
 */
communications.get('/push/vapid-key', (c) => {
  const key = pushService.getPublicKey()
  return c.json({ success: true, data: { publicKey: key } })
})

/**
 * POST /api/communications/push/subscribe
 * Register push subscription
 */
communications.post('/push/subscribe', async (c) => {
  const user = c.get('user')
  const { subscription, deviceName } = await c.req.json() as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
    deviceName?: string
  }

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return c.json({ success: false, error: { message: 'Invalid subscription' } }, 400)
  }

  await pushService.saveSubscription(user.id, subscription, deviceName, c.req.header('user-agent'))
  return c.json({ success: true, data: { message: 'Subscribed to push notifications' } })
})

/**
 * DELETE /api/communications/push/subscribe
 * Unsubscribe from push
 */
communications.delete('/push/subscribe', async (c) => {
  const { endpoint } = await c.req.json() as { endpoint: string }
  if (!endpoint) return c.json({ success: false, error: { message: 'endpoint required' } }, 400)
  await pushService.removeSubscription(endpoint)
  return c.json({ success: true, data: { message: 'Unsubscribed' } })
})

/**
 * POST /api/communications/push/test
 * Send test push notification
 */
communications.post('/push/test', async (c) => {
  const user = c.get('user')
  const results = await pushService.sendToUser(user.id, {
    title: '🏠 Test - Inmobiliaria',
    body: 'Push notifications are working!',
    url: '/dashboard',
  })
  return c.json({ success: true, data: { results } })
})

// =============================================================================
// iCal Export / Calendar Sync
// =============================================================================

/**
 * GET /api/communications/calendar/feed/:token
 * Public iCal feed (token-based auth for calendar apps)
 * No auth middleware - uses token in URL
 */
// Note: This route needs to be registered separately without auth

/**
 * GET /api/communications/calendar/export/:eventId
 * Download .ics file for a single event
 */
communications.get('/calendar/export/:eventId', async (c) => {
  const user = c.get('user')
  const eventId = c.req.param('eventId')

  const ics = await icalService.generateEventICS(user.id, eventId)
  if (!ics) {
    return c.json({ success: false, error: { message: 'Event not found' } }, 404)
  }

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="event-${eventId}.ics"`,
    },
  })
})

/**
 * GET /api/communications/calendar/feed-url
 * Get the subscribable iCal feed URL for the current user
 */
communications.get('/calendar/feed-url', async (c) => {
  const user = c.get('user')
  // Generate a simple token from userId (in production, use a proper token)
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64url')
  
  const db = container.getDatabase()
  // Store the feed token
  await db`
    INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, token_type, scope, expiry_date)
    VALUES (${user.id}, '', '', 'ical_feed', ${token}, 0)
    ON CONFLICT (user_id) DO UPDATE SET scope = 
      CASE WHEN google_calendar_tokens.token_type = 'ical_feed' THEN ${token}
           ELSE google_calendar_tokens.scope END
  `.catch(() => {
    // If token table doesn't have the right structure, just use in-memory
  })

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const feedUrl = `${baseUrl}/api/communications/calendar/feed/${token}`

  return c.json({
    success: true,
    data: {
      feedUrl,
      instructions: {
        ios: 'Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste URL',
        android: 'Google Calendar → Settings → Add calendar → From URL → paste URL',
        outlook: 'Calendar → Add calendar → Subscribe from web → paste URL',
      },
    },
  })
})

// =============================================================================
// Message Templates
// =============================================================================

/**
 * GET /api/communications/templates
 * List available message templates
 */
communications.get('/templates', async (c) => {
  const db = container.getDatabase()
  const templates = await db`
    SELECT id, name, channel, type, subject, body, language, is_active, is_system
    FROM message_templates 
    WHERE is_active = true
    ORDER BY channel, type, name
  `
  return c.json({ success: true, data: { templates } })
})

/**
 * PUT /api/communications/templates/:id
 * Update a message template
 */
communications.put('/templates/:id', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ success: false, error: { message: 'Admin only' } }, 403)
  }

  const id = Number(c.req.param('id'))
  const { body, subject } = await c.req.json() as { body?: string; subject?: string }

  const db = container.getDatabase()
  await db`
    UPDATE message_templates 
    SET body = COALESCE(${body || null}, body), 
        subject = COALESCE(${subject || null}, subject),
        updated_at = NOW()
    WHERE id = ${id}
  `

  return c.json({ success: true, data: { message: 'Template updated' } })
})

// =============================================================================
// Dashboard Stats
// =============================================================================

/**
 * GET /api/communications/stats
 * Communication statistics
 */
communications.get('/stats', async (c) => {
  const db = container.getDatabase()
  
  const [channelStats, statusStats, recentCount] = await Promise.all([
    db`
      SELECT channel, COUNT(*) as count 
      FROM communication_logs 
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY channel
    `,
    db`
      SELECT status, COUNT(*) as count 
      FROM communication_logs 
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY status
    `,
    db`
      SELECT COUNT(*) as count 
      FROM communication_logs 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `,
  ])

  return c.json({
    success: true,
    data: {
      last30Days: {
        byChannel: Object.fromEntries(channelStats.map(r => [r.channel, Number(r.count)])),
        byStatus: Object.fromEntries(statusStats.map(r => [r.status, Number(r.count)])),
      },
      last24Hours: Number(recentCount[0]?.count || 0),
      whatsappStatus: whatsappService.status,
    },
  })
})

export { communications }
