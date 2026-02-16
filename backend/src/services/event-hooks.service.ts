/**
 * @fileoverview Event Hooks - Triggers notifications when calendar events are created/updated
 * This is the glue that connects calendar events to WhatsApp/Push/SMS
 */

import { container } from '../lib/container'
import { logger } from '../lib/logger'
import * as orchestrator from './notification-orchestrator.service'
import type { CalendarEventInput, CalendarEvent } from './google-calendar.service'

/**
 * Called after a calendar event is successfully created
 * Triggers: WhatsApp confirmation to client + Push to agent + schedules reminders
 */
export async function onEventCreated(
  userId: number,
  event: CalendarEvent,
  input: CalendarEventInput
): Promise<void> {
  try {
    const db = container.getDatabase()

    // Get agent info
    const agents = await db`SELECT id, email FROM users WHERE id = ${userId}`
    const agent = agents[0]

    // Get client info if clientId provided
    let client: any = null
    if (input.clientId) {
      const clients = await db`SELECT id, full_name, phone, email FROM clients WHERE id = ${input.clientId}`
      client = clients[0]
    }

    // Get property info if propertyId provided
    let property: any = null
    if (input.propertyId) {
      const properties = await db`SELECT id, address, title FROM properties WHERE id = ${input.propertyId}`
      property = properties[0]
    }

    const startTime = new Date(input.startTime)
    const templateData: Record<string, string | number> = {
      clientName: client?.full_name || 'Cliente',
      agentName: agent?.email || 'Agente',
      agentPhone: '', // Would come from agent profile
      propertyAddress: property?.address || input.location || 'Por confirmar',
      location: input.location || property?.address || '',
      date: startTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
      time: startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      eventType: input.eventType || 'viewing',
      summary: input.summary,
    }

    // 1. Send WhatsApp confirmation to client (with fallback to SMS/email)
    if (client?.phone || client?.email) {
      const confirmResult = await orchestrator.sendNotification({
        clientId: input.clientId,
        userId,
        type: getNotificationType(input.eventType, 'confirmation'),
        templateName: `whatsapp_${input.eventType || 'viewing'}_confirmation`,
        templateData,
        eventId: event.id,
        propertyId: input.propertyId,
      })

      logger.info('Event confirmation sent', {
        eventId: event.id,
        clientId: input.clientId,
        channel: confirmResult.channel,
        success: confirmResult.success,
      })
    }

    // 2. Push notification to agent
    await orchestrator.notifyAgent(
      userId,
      `📅 ${input.eventType === 'viewing' ? 'Visita' : 'Evento'} creado`,
      `${input.summary} - ${templateData.date} ${templateData.time}`,
      `/dashboard/calendar?event=${event.id}`,
      { eventId: event.id, eventType: input.eventType }
    )

    // 3. Schedule reminders (24h, 1h before + follow-up)
    if (input.clientId) {
      await orchestrator.scheduleEventReminders({
        eventId: event.id!,
        clientId: input.clientId,
        agentUserId: userId,
        propertyId: input.propertyId,
        eventTime: startTime,
        clientPhone: client?.phone,
        templateData,
      })
    }

  } catch (error) {
    // Don't fail the event creation if notifications fail
    logger.error('Event hooks failed', { eventId: event.id, error })
  }
}

/**
 * Called when a calendar event is updated
 */
export async function onEventUpdated(
  userId: number,
  eventId: string,
  input: Partial<CalendarEventInput>
): Promise<void> {
  // If time changed, reschedule reminders
  if (input.startTime && input.clientId) {
    try {
      const db = container.getDatabase()
      const clients = await db`SELECT phone FROM clients WHERE id = ${input.clientId}`
      
      await orchestrator.scheduleEventReminders({
        eventId,
        clientId: input.clientId,
        agentUserId: userId,
        propertyId: input.propertyId,
        eventTime: new Date(input.startTime),
        clientPhone: clients[0]?.phone as string,
        templateData: {
          clientName: 'Cliente',
          date: new Date(input.startTime).toLocaleDateString('es-ES'),
          time: new Date(input.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        },
      })
    } catch (error) {
      logger.error('Failed to reschedule reminders', { eventId, error })
    }
  }
}

/**
 * Called when a calendar event is deleted
 */
export async function onEventDeleted(userId: number, eventId: string): Promise<void> {
  try {
    const db = container.getDatabase()
    // Cancel all scheduled communications for this event
    await db`
      UPDATE scheduled_communications 
      SET is_cancelled = true, cancelled_at = NOW(), cancelled_reason = 'event_deleted'
      WHERE event_id = ${eventId} AND NOT is_sent AND NOT is_cancelled
    `
    logger.info('Cancelled reminders for deleted event', { eventId })
  } catch (error) {
    logger.error('Failed to cancel reminders', { eventId, error })
  }
}

function getNotificationType(eventType?: string, action?: string): any {
  if (eventType === 'viewing') return `viewing_${action}` as any
  return `appointment_${action}` as any
}
