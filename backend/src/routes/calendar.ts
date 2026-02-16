/**
 * @fileoverview Google Calendar API Routes
 * Handles OAuth flow, event CRUD, and sync operations
 */

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import type { AppVariables } from '../types'
import * as calendarService from '../services/google-calendar.service'
import * as eventHooks from '../services/event-hooks.service'
import { logger } from '../lib/logger'

const calendar = new Hono<{ Variables: AppVariables }>()

// Auth middleware for all routes EXCEPT the OAuth callback (Google redirects browser here without JWT)
calendar.use('*', async (c, next) => {
  if (c.req.path.endsWith('/auth/callback')) {
    return next()
  }
  return requireAuth()(c, next)
})

// =============================================================================
// OAuth2 Flow
// =============================================================================

/**
 * GET /api/calendar/auth/url
 * Returns the Google OAuth2 consent URL
 */
calendar.get('/auth/url', (c) => {
  const user = c.get('user')
  try {
    const url = calendarService.getAuthUrl(user.id)
    return c.json({ success: true, data: { url } })
  } catch (error) {
    logger.error('Failed to generate auth URL', { error })
    return c.json({ success: false, error: { message: 'Google Calendar not configured on server' } }, 500)
  }
})

/**
 * GET /api/calendar/auth/callback?code=...&state=...
 * Handles the OAuth2 callback from Google
 */
calendar.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    // Redirect to frontend settings with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    return c.redirect(`${frontendUrl}/dashboard/settings?calendar_error=${error}`)
  }

  if (!code) {
    return c.json({ success: false, error: { message: 'Missing authorization code' } }, 400)
  }

  try {
    if (!state) {
      return c.json({ success: false, error: { message: 'Missing state parameter (userId)' } }, 400)
    }
    const userId = Number(state)
    if (!userId || isNaN(userId)) {
      return c.json({ success: false, error: { message: 'Invalid state parameter' } }, 400)
    }
    const tokens = await calendarService.exchangeCode(code)
    await calendarService.saveTokens(userId, tokens)

    logger.info('Google Calendar connected', { userId })

    // Redirect to frontend settings with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    return c.redirect(`${frontendUrl}/dashboard/settings?calendar_connected=true`)
  } catch (err) {
    logger.error('OAuth callback failed', { error: err })
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    return c.redirect(`${frontendUrl}/dashboard/settings?calendar_error=token_exchange_failed`)
  }
})

/**
 * GET /api/calendar/status
 * Check if Google Calendar is connected for the current user
 */
calendar.get('/status', async (c) => {
  const user = c.get('user')
  const status = await calendarService.getConnectionStatus(user.id)
  return c.json({ success: true, data: status })
})

/**
 * POST /api/calendar/disconnect
 * Disconnect Google Calendar
 */
calendar.post('/disconnect', async (c) => {
  const user = c.get('user')
  await calendarService.deleteTokens(user.id)
  return c.json({ success: true, data: { message: 'Google Calendar disconnected' } })
})

// =============================================================================
// Event CRUD
// =============================================================================

const eventInputSchema = z.object({
  summary: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  startTime: z.string(), // ISO 8601
  endTime: z.string(),   // ISO 8601
  allDay: z.boolean().optional().default(false),
  timeZone: z.string().optional().default('Europe/Madrid'),
  propertyId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  eventType: z.enum(['viewing', 'meeting', 'signing', 'other']).optional().default('viewing'),
  attendeeEmails: z.array(z.string().email()).optional(),
})

/**
 * GET /api/calendar/events
 * List events in a date range
 * Query params: timeMin, timeMax (ISO 8601), sync (boolean)
 */
calendar.get('/events', async (c) => {
  const user = c.get('user')
  const timeMin = c.req.query('timeMin') || new Date().toISOString()
  const timeMax = c.req.query('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const sync = c.req.query('sync') === 'true'

  try {
    let events
    if (sync) {
      events = await calendarService.syncEventsToCache(user.id, timeMin, timeMax)
    } else {
      events = await calendarService.listEvents(user.id, timeMin, timeMax)
    }
    return c.json({ success: true, data: { events, count: events.length } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch events'
    logger.error('Failed to list events', { error, userId: user.id })
    return c.json({ success: false, error: { message } }, 500)
  }
})

/**
 * POST /api/calendar/events
 * Create a new calendar event
 */
calendar.post('/events', async (c) => {
  const user = c.get('user')
  
  const body = await c.req.json()
  const parsed = eventInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ 
      success: false, 
      error: { message: 'Validation failed', details: parsed.error.flatten() } 
    }, 400)
  }

  try {
    const event = await calendarService.createEvent(user.id, parsed.data)
    
    // Trigger notifications (WhatsApp + Push + schedule reminders) - fire and forget
    void eventHooks.onEventCreated(user.id, event, parsed.data)
    
    return c.json({ success: true, data: { event } }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create event'
    logger.error('Failed to create event', { error, userId: user.id })
    return c.json({ success: false, error: { message } }, 500)
  }
})

/**
 * PUT /api/calendar/events/:eventId
 * Update an existing calendar event
 */
calendar.put('/events/:eventId', async (c) => {
  const user = c.get('user')
  const eventId = c.req.param('eventId')

  const body = await c.req.json()
  const parsed = eventInputSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ 
      success: false, 
      error: { message: 'Validation failed', details: parsed.error.flatten() } 
    }, 400)
  }

  try {
    const event = await calendarService.updateEvent(user.id, eventId, parsed.data)
    
    // Reschedule reminders if time changed
    void eventHooks.onEventUpdated(user.id, eventId, parsed.data as calendarService.CalendarEventInput)
    
    return c.json({ success: true, data: { event } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update event'
    logger.error('Failed to update event', { error, userId: user.id, eventId })
    return c.json({ success: false, error: { message } }, 500)
  }
})

/**
 * DELETE /api/calendar/events/:eventId
 * Delete a calendar event
 */
calendar.delete('/events/:eventId', async (c) => {
  const user = c.get('user')
  const eventId = c.req.param('eventId')

  try {
    await calendarService.deleteEvent(user.id, eventId)
    
    // Cancel scheduled reminders
    void eventHooks.onEventDeleted(user.id, eventId)
    
    return c.json({ success: true, data: { message: 'Event deleted' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete event'
    logger.error('Failed to delete event', { error, userId: user.id, eventId })
    return c.json({ success: false, error: { message } }, 500)
  }
})

export { calendar }
