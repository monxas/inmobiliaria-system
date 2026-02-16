/**
 * @fileoverview Event Automation API Routes
 * Full event lifecycle: create → remind → complete → follow-up → analytics
 */

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import type { AppVariables } from '../types'
import * as eventService from '../services/event-automation.service'
import { logger } from '../lib/logger'

const events = new Hono<{ Variables: AppVariables }>()

// All routes require auth
events.use('*', requireAuth())

// =============================================================================
// Validation Schemas
// =============================================================================

const createEventSchema = z.object({
  title: z.string().min(1).max(500),
  eventType: z.enum(['viewing', 'follow_up', 'contract_signing', 'key_handover', 'valuation', 'open_house', 'consultation', 'inspection', 'negotiation', 'other']),
  templateId: z.number().int().positive().optional(),
  startTime: z.string(),
  endTime: z.string().optional(),
  allDay: z.boolean().optional(),
  timezone: z.string().optional(),
  location: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  virtualMeetingUrl: z.string().url().optional(),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
  propertyId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
  attendees: z.array(z.object({
    clientId: z.number().int().positive().optional(),
    userId: z.number().int().positive().optional(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    notifyEmail: z.boolean().optional(),
    notifySms: z.boolean().optional(),
  })).optional(),
  customReminders: z.array(z.object({
    channel: z.enum(['email', 'sms', 'push', 'in_app']),
    minutesBefore: z.number().int().positive(),
  })).optional(),
  skipAutomation: z.boolean().optional(),
})

const completeEventSchema = z.object({
  outcomeNotes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  clientSatisfaction: z.number().int().min(1).max(5).optional(),
  clientFeedback: z.string().optional(),
  ledToOffer: z.boolean().optional(),
  ledToContract: z.boolean().optional(),
  conversionValue: z.number().positive().optional(),
  skipFollowUp: z.boolean().optional(),
})

// =============================================================================
// Templates
// =============================================================================

/** GET /api/events/templates - List all active event templates */
events.get('/templates', async (c) => {
  const templates = await eventService.listTemplates()
  return c.json({ success: true, data: { templates } })
})

/** GET /api/events/templates/:name - Get template by name */
events.get('/templates/:name', async (c) => {
  const template = await eventService.getTemplateByName(c.req.param('name'))
  if (!template) return c.json({ success: false, error: { message: 'Template not found' } }, 404)
  return c.json({ success: true, data: { template } })
})

// =============================================================================
// Event CRUD
// =============================================================================

/** GET /api/events - List events with filters */
events.get('/', async (c) => {
  const user = c.get('user')
  const query = c.req.query()

  const result = await eventService.listEvents({
    agentId: query.agentId ? Number(query.agentId) : (query.allAgents === 'true' ? undefined : user.id),
    clientId: query.clientId ? Number(query.clientId) : undefined,
    propertyId: query.propertyId ? Number(query.propertyId) : undefined,
    eventType: query.eventType,
    status: query.status,
    startFrom: query.startFrom,
    startTo: query.startTo,
    limit: query.limit ? Number(query.limit) : 50,
    offset: query.offset ? Number(query.offset) : 0,
  })

  return c.json({ success: true, data: result })
})

/** POST /api/events - Create event with automation */
events.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const parsed = createEventSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, error: { message: 'Validation failed', details: parsed.error.flatten() } }, 400)
  }

  try {
    const event = await eventService.createEvent(
      { ...parsed.data, agentId: parsed.data.agentId || user.id } as eventService.CreateEventInput,
      user.id
    )
    return c.json({ success: true, data: { event } }, 201)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create event'
    logger.error('Event creation failed', { error, userId: user.id })
    return c.json({ success: false, error: { message: msg } }, 500)
  }
})

/** GET /api/events/:id - Get event with all relations */
events.get('/:id', async (c) => {
  try {
    const event = await eventService.getEventById(Number(c.req.param('id')))
    return c.json({ success: true, data: { event } })
  } catch (error) {
    return c.json({ success: false, error: { message: 'Event not found' } }, 404)
  }
})

/** POST /api/events/:id/complete - Complete event (triggers follow-up automation) */
events.post('/:id/complete', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const parsed = completeEventSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, error: { message: 'Validation failed', details: parsed.error.flatten() } }, 400)
  }

  try {
    const result = await eventService.completeEvent(Number(c.req.param('id')), parsed.data, user.id)
    return c.json({
      success: true,
      data: {
        event: result.event,
        followUpEvent: result.followUpEvent || null,
        suggestedNextSteps: result.suggestedNextSteps,
        message: result.followUpEvent
          ? `Event completed. Follow-up "${result.followUpEvent.title}" auto-scheduled for ${result.followUpEvent.startTime}`
          : 'Event completed successfully.',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to complete event'
    logger.error('Event completion failed', { error })
    return c.json({ success: false, error: { message: msg } }, 500)
  }
})

/** POST /api/events/:id/cancel - Cancel event */
events.post('/:id/cancel', async (c) => {
  const user = c.get('user')
  const { reason } = await c.req.json().catch(() => ({ reason: 'Cancelled' }))

  try {
    const event = await eventService.cancelEvent(Number(c.req.param('id')), reason, user.id)
    return c.json({ success: true, data: { event } })
  } catch (error) {
    return c.json({ success: false, error: { message: 'Failed to cancel event' } }, 500)
  }
})

/** POST /api/events/:id/no-show - Mark as no-show */
events.post('/:id/no-show', async (c) => {
  const user = c.get('user')
  const { notes } = await c.req.json().catch(() => ({ notes: undefined }))

  try {
    const event = await eventService.markNoShow(Number(c.req.param('id')), notes, user.id)
    return c.json({ success: true, data: { event } })
  } catch (error) {
    return c.json({ success: false, error: { message: 'Failed to mark no-show' } }, 500)
  }
})

// =============================================================================
// Analytics
// =============================================================================

/** GET /api/events/analytics/summary - Get event analytics */
events.get('/analytics/summary', async (c) => {
  const user = c.get('user')
  const query = c.req.query()

  const analytics = await eventService.getEventAnalytics({
    agentId: query.agentId ? Number(query.agentId) : (query.allAgents === 'true' ? undefined : user.id),
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    eventType: query.eventType,
  })

  return c.json({ success: true, data: { analytics } })
})

// =============================================================================
// Reminder Processing (internal/cron endpoint)
// =============================================================================

/** POST /api/events/reminders/process - Process pending reminders */
events.post('/reminders/process', async (c) => {
  try {
    const processed = await eventService.processPendingReminders()
    return c.json({ success: true, data: { processed } })
  } catch (error) {
    logger.error('Reminder processing failed', { error })
    return c.json({ success: false, error: { message: 'Reminder processing failed' } }, 500)
  }
})

export { events }
