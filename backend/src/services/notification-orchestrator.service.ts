/**
 * @fileoverview Notification Orchestrator
 * Coordinates multi-channel notifications with automatic fallback:
 * WhatsApp → SMS → Email
 * Also handles push notifications to agents and scheduled reminders.
 */

import { container } from '../lib/container'
import { logger } from '../lib/logger'
import { whatsappService, renderTemplate, getTemplate } from './whatsapp.service'
import * as pushService from './push-notification.service'

// =============================================================================
// Types
// =============================================================================

export interface NotificationRequest {
  // Target
  clientId?: number
  userId?: number       // Agent to notify via push
  recipientPhone?: string
  recipientEmail?: string
  recipientName?: string

  // Content
  type: CommunicationType
  templateName?: string
  templateData?: Record<string, string | number>
  customMessage?: string
  subject?: string

  // Context
  eventId?: string
  propertyId?: number
  viewingId?: number

  // Options
  channels?: Channel[]  // Override default channel priority
  skipFallback?: boolean
}

type Channel = 'whatsapp' | 'sms' | 'email' | 'push'
type CommunicationType = 
  | 'appointment_confirmation' | 'appointment_reminder' | 'appointment_followup'
  | 'viewing_confirmation' | 'viewing_reminder' | 'viewing_followup'
  | 'document_shared' | 'general' | 'custom'

interface SendResult {
  success: boolean
  channel: Channel
  messageId?: string
  error?: string
  fallbackUsed?: boolean
  logId?: number
}

// =============================================================================
// Orchestrator
// =============================================================================

/**
 * Send notification with automatic fallback chain
 * Default priority: WhatsApp → SMS → Email
 */
export async function sendNotification(req: NotificationRequest): Promise<SendResult> {
  const channels = req.channels || ['whatsapp', 'sms', 'email']
  
  // Resolve recipient info from client if needed
  const recipient = await resolveRecipient(req)
  if (!recipient.phone && !recipient.email) {
    return { success: false, channel: channels[0], error: 'No contact info for recipient' }
  }

  // Resolve message content
  const message = await resolveMessage(req)
  if (!message) {
    return { success: false, channel: channels[0], error: 'Could not resolve message content' }
  }

  // Try each channel in order
  let fallbackFrom: number | undefined
  for (const channel of channels) {
    const result = await trySendChannel(channel, recipient, message, req)
    
    // Log the communication
    const logId = await logCommunication({
      ...req,
      channel,
      message: message.body,
      subject: message.subject,
      status: result.success ? 'sent' : 'failed',
      recipientPhone: recipient.phone,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      providerMessageId: result.messageId,
      errorMessage: result.error,
      fallbackFrom,
    })

    if (result.success) {
      return { ...result, logId, fallbackUsed: fallbackFrom !== undefined }
    }

    // Track fallback chain
    fallbackFrom = logId
    
    if (req.skipFallback) break
    
    logger.info(`Channel ${channel} failed, trying next fallback`, { 
      error: result.error, 
      nextChannel: channels[channels.indexOf(channel) + 1] 
    })
  }

  return { success: false, channel: channels[channels.length - 1], error: 'All channels failed' }
}

/**
 * Send push notification to an agent
 */
export async function notifyAgent(
  userId: number, 
  title: string, 
  body: string, 
  url?: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await pushService.sendToUser(userId, { title, body, url, data, icon: '/icons/icon-192.png' })
  } catch (error) {
    logger.error('Failed to send push to agent', { userId, error })
  }
}

/**
 * Schedule reminders for an event
 * Creates scheduled communications for: 24h before, 1h before, and follow-up next day
 */
export async function scheduleEventReminders(params: {
  eventId: string
  clientId: number
  agentUserId: number
  propertyId?: number
  viewingId?: number
  eventTime: Date
  clientPhone?: string
  templateData: Record<string, string | number>
}): Promise<void> {
  const db = container.getDatabase()
  const { eventId, clientId, agentUserId, propertyId, viewingId, eventTime, clientPhone, templateData } = params

  // Cancel any existing reminders for this event
  await db`
    UPDATE scheduled_communications 
    SET is_cancelled = true, cancelled_at = NOW(), cancelled_reason = 'event_updated'
    WHERE event_id = ${eventId} AND NOT is_sent AND NOT is_cancelled
  `

  const reminders = [
    // 24h reminder to client
    { templateName: 'whatsapp_viewing_reminder', scheduledAt: new Date(eventTime.getTime() - 24 * 60 * 60 * 1000), channel: 'whatsapp' as Channel },
    // 1h reminder to client
    { templateName: 'whatsapp_viewing_reminder', scheduledAt: new Date(eventTime.getTime() - 60 * 60 * 1000), channel: 'whatsapp' as Channel },
    // Follow-up next day
    { templateName: 'whatsapp_viewing_followup', scheduledAt: new Date(eventTime.getTime() + 24 * 60 * 60 * 1000), channel: 'whatsapp' as Channel },
  ]

  for (const reminder of reminders) {
    // Only schedule if in the future
    if (reminder.scheduledAt > new Date()) {
      await db`
        INSERT INTO scheduled_communications 
          (template_name, template_data, client_id, user_id, recipient_phone, 
           scheduled_at, channel, event_id, property_id, viewing_id)
        VALUES 
          (${reminder.templateName}, ${JSON.stringify(templateData)}, ${clientId}, ${agentUserId},
           ${clientPhone || null}, ${reminder.scheduledAt.toISOString()}, ${reminder.channel},
           ${eventId}, ${propertyId || null}, ${viewingId || null})
      `
    }
  }

  logger.info('Event reminders scheduled', { eventId, remindersCount: reminders.length })
}

/**
 * Process due scheduled communications (called by cron/interval)
 */
export async function processScheduledCommunications(): Promise<number> {
  const db = container.getDatabase()
  
  const due = await db`
    SELECT sc.*, mt.body as template_body, mt.subject as template_subject,
           c.phone as client_phone, c.email as client_email, c.full_name as client_name
    FROM scheduled_communications sc
    LEFT JOIN message_templates mt ON mt.name = sc.template_name
    LEFT JOIN clients c ON c.id = sc.client_id
    WHERE sc.scheduled_at <= NOW() 
      AND NOT sc.is_sent 
      AND NOT sc.is_cancelled
    ORDER BY sc.scheduled_at ASC
    LIMIT 50
  `

  let processed = 0
  for (const item of due) {
    try {
      const templateData = (item.template_data as Record<string, string | number>) || {}
      const message = item.template_body 
        ? renderTemplate(item.template_body as string, templateData)
        : null

      if (!message) {
        logger.warn('No template body for scheduled comm', { id: item.id })
        continue
      }

      const result = await sendNotification({
        clientId: item.client_id as number,
        userId: item.user_id as number | undefined,
        recipientPhone: (item.recipient_phone || item.client_phone) as string,
        recipientEmail: item.client_email as string | undefined,
        recipientName: item.client_name as string | undefined,
        type: 'viewing_reminder',
        customMessage: message,
        eventId: item.event_id as string | undefined,
        propertyId: item.property_id as number | undefined,
        viewingId: item.viewing_id as number | undefined,
      })

      await db`
        UPDATE scheduled_communications 
        SET is_sent = true, sent_at = NOW(), communication_log_id = ${result.logId || null}
        WHERE id = ${item.id}
      `
      processed++
    } catch (error) {
      logger.error('Failed to process scheduled communication', { id: item.id, error })
    }
  }

  if (processed > 0) {
    logger.info(`Processed ${processed} scheduled communications`)
  }
  return processed
}

// =============================================================================
// Internal Helpers
// =============================================================================

async function resolveRecipient(req: NotificationRequest): Promise<{ phone?: string; email?: string; name?: string }> {
  if (req.recipientPhone || req.recipientEmail) {
    return { phone: req.recipientPhone, email: req.recipientEmail, name: req.recipientName }
  }

  if (req.clientId) {
    const db = container.getDatabase()
    const rows = await db`SELECT phone, email, full_name FROM clients WHERE id = ${req.clientId}`
    if (rows.length > 0) {
      return { 
        phone: rows[0].phone as string | undefined, 
        email: rows[0].email as string | undefined, 
        name: rows[0].full_name as string 
      }
    }
  }

  return {}
}

async function resolveMessage(req: NotificationRequest): Promise<{ body: string; subject?: string } | null> {
  if (req.customMessage) {
    return { body: req.customMessage, subject: req.subject }
  }

  if (req.templateName) {
    const template = await getTemplate(req.templateName)
    if (template) {
      return {
        body: renderTemplate(template.body, req.templateData || {}),
        subject: template.subject ? renderTemplate(template.subject, req.templateData || {}) : undefined,
      }
    }
  }

  return null
}

async function trySendChannel(
  channel: Channel,
  recipient: { phone?: string; email?: string; name?: string },
  message: { body: string; subject?: string },
  req: NotificationRequest
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  switch (channel) {
    case 'whatsapp':
      if (!recipient.phone) return { success: false, error: 'No phone number' }
      return whatsappService.sendMessage({ to: recipient.phone, message: message.body })

    case 'sms':
      if (!recipient.phone) return { success: false, error: 'No phone number' }
      return sendSMS(recipient.phone, message.body)

    case 'email':
      if (!recipient.email) return { success: false, error: 'No email address' }
      return sendEmail(recipient.email, message.subject || 'Inmobiliaria - Notificación', message.body)

    case 'push':
      if (!req.userId) return { success: false, error: 'No user ID for push' }
      const results = await pushService.sendToUser(req.userId, {
        title: message.subject || 'Notificación',
        body: message.body,
      })
      const anySuccess = results.some(r => r.success)
      return { success: anySuccess, error: anySuccess ? undefined : 'Push delivery failed' }

    default:
      return { success: false, error: `Unknown channel: ${channel}` }
  }
}

/**
 * Send SMS via configured provider (Twilio-compatible)
 */
async function sendSMS(to: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'SMS provider not configured' }
  }

  try {
    // Normalize phone with + prefix
    const normalizedTo = to.startsWith('+') ? to : `+${to.replace(/[\s\-\(\)]/g, '')}`
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: normalizedTo, From: fromNumber, Body: body }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `SMS failed: ${response.status} - ${error}` }
    }

    const data = await response.json() as { sid: string }
    return { success: true, messageId: data.sid }
  } catch (error) {
    return { success: false, error: `SMS error: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * Send email via the existing email queue or direct SMTP
 */
async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const db = container.getDatabase()
    // Insert into email queue for async processing
    const rows = await db`
      INSERT INTO email_queue (to_email, subject, template_name, html_content, text_content, status)
      VALUES (${to}, ${subject}, 'custom', ${`<p>${body.replace(/\n/g, '<br>')}</p>`}, ${body}, 'pending')
      RETURNING id
    `
    return { success: true, messageId: `email-${rows[0].id}` }
  } catch (error) {
    return { success: false, error: `Email queue error: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function logCommunication(params: {
  clientId?: number
  userId?: number
  channel: string
  type?: string
  message: string
  subject?: string
  status: string
  recipientPhone?: string
  recipientEmail?: string
  recipientName?: string
  eventId?: string
  propertyId?: number
  viewingId?: number
  providerMessageId?: string
  errorMessage?: string
  fallbackFrom?: number
}): Promise<number | undefined> {
  try {
    const db = container.getDatabase()
    const rows = await db`
      INSERT INTO communication_logs 
        (client_id, user_id, channel, type, message, subject, status, 
         recipient_phone, recipient_email, recipient_name,
         event_id, property_id, viewing_id,
         provider_message_id, error_message, fallback_from,
         sent_at)
      VALUES 
        (${params.clientId || null}, ${params.userId || null}, 
         ${params.channel}, ${params.type || 'general'}, ${params.message}, ${params.subject || null},
         ${params.status}, ${params.recipientPhone || null}, ${params.recipientEmail || null}, 
         ${params.recipientName || null}, ${params.eventId || null}, ${params.propertyId || null},
         ${params.viewingId || null}, ${params.providerMessageId || null}, ${params.errorMessage || null},
         ${params.fallbackFrom || null},
         ${params.status === 'sent' ? new Date().toISOString() : null})
      RETURNING id
    `
    return rows[0]?.id as number
  } catch (error) {
    logger.error('Failed to log communication', { error })
    return undefined
  }
}

// =============================================================================
// Scheduler (runs every minute)
// =============================================================================

let schedulerInterval: ReturnType<typeof setInterval> | null = null

export function startScheduler(): void {
  if (schedulerInterval) return
  schedulerInterval = setInterval(() => {
    void processScheduledCommunications()
  }, 60000) // Every minute
  logger.info('Communication scheduler started')
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}
