/**
 * @fileoverview Google Calendar API v3 Service
 * Handles OAuth2 token management and Calendar CRUD operations
 */

import { getConfig } from '../config'
import { container } from '../lib/container'
import { logger } from '../lib/logger'

// =============================================================================
// Types
// =============================================================================

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  token_type: string
  scope: string
  expiry_date: number // Unix timestamp ms
}

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  location?: string
  start: { dateTime: string; timeZone?: string } | { date: string }
  end: { dateTime: string; timeZone?: string } | { date: string }
  attendees?: Array<{ email: string; displayName?: string }>
  reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> }
  extendedProperties?: {
    private?: Record<string, string>
  }
  colorId?: string
  status?: string
  htmlLink?: string
}

export interface CalendarEventInput {
  summary: string
  description?: string
  location?: string
  startTime: string // ISO 8601
  endTime: string   // ISO 8601
  allDay?: boolean
  timeZone?: string
  propertyId?: number
  clientId?: number
  eventType?: 'viewing' | 'meeting' | 'signing' | 'other'
  attendeeEmails?: string[]
}

interface GoogleCalendarConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

// =============================================================================
// Configuration
// =============================================================================

function getGoogleConfig(): GoogleCalendarConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Calendar not configured: missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI')
  }

  return { clientId, clientSecret, redirectUri }
}

// =============================================================================
// OAuth2 Flow
// =============================================================================

const SCOPES = ['https://www.googleapis.com/auth/calendar']
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

/**
 * Generate OAuth2 consent URL
 */
export function getAuthUrl(userId: number): string {
  const config = getGoogleConfig()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: String(userId), // Pass userId through OAuth flow
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const config = getGoogleConfig()
  
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    logger.error('Google OAuth token exchange failed', { error, status: response.status })
    throw new Error(`Token exchange failed: ${response.status}`)
  }

  const data = await response.json() as {
    access_token: string
    refresh_token: string
    token_type: string
    scope: string
    expires_in: number
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    scope: data.scope,
    expiry_date: Date.now() + (data.expires_in * 1000),
  }
}

/**
 * Refresh expired access token
 */
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry_date: number }> {
  const config = getGoogleConfig()

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    logger.error('Google token refresh failed', { error })
    throw new Error('Token refresh failed - user may need to re-authorize')
  }

  const data = await response.json() as { access_token: string; expires_in: number }
  return {
    access_token: data.access_token,
    expiry_date: Date.now() + (data.expires_in * 1000),
  }
}

// =============================================================================
// Token Storage (Database)
// =============================================================================

export async function saveTokens(userId: number, tokens: GoogleTokens): Promise<void> {
  const db = container.getDatabase()
  await db`
    INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, token_type, scope, expiry_date, updated_at)
    VALUES (${userId}, ${tokens.access_token}, ${tokens.refresh_token}, ${tokens.token_type}, ${tokens.scope}, ${tokens.expiry_date}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, google_calendar_tokens.refresh_token),
      token_type = EXCLUDED.token_type,
      scope = EXCLUDED.scope,
      expiry_date = EXCLUDED.expiry_date,
      updated_at = NOW()
  `
}

export async function getTokens(userId: number): Promise<GoogleTokens | null> {
  const db = container.getDatabase()
  const rows = await db`
    SELECT access_token, refresh_token, token_type, scope, expiry_date
    FROM google_calendar_tokens WHERE user_id = ${userId}
  `
  if (rows.length === 0) return null
  return rows[0] as unknown as GoogleTokens
}

export async function deleteTokens(userId: number): Promise<void> {
  const db = container.getDatabase()
  await db`DELETE FROM google_calendar_tokens WHERE user_id = ${userId}`
  await db`DELETE FROM calendar_events_cache WHERE user_id = ${userId}`
}

/**
 * Get valid access token, refreshing if expired
 */
async function getValidAccessToken(userId: number): Promise<string> {
  const tokens = await getTokens(userId)
  if (!tokens) throw new Error('Google Calendar not connected')

  // Refresh if expiring within 5 minutes
  if (tokens.expiry_date < Date.now() + 300000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token)
    await saveTokens(userId, {
      ...tokens,
      access_token: refreshed.access_token,
      expiry_date: refreshed.expiry_date,
    })
    return refreshed.access_token
  }

  return tokens.access_token
}

// =============================================================================
// Calendar API Operations
// =============================================================================

async function calendarFetch(userId: number, path: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = await getValidAccessToken(userId)
  
  const response = await fetch(`${CALENDAR_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (response.status === 401) {
    // Token might have been revoked
    throw new Error('Google Calendar authorization expired - please reconnect')
  }

  return response
}

/**
 * List events in a date range
 */
export async function listEvents(
  userId: number,
  timeMin: string,
  timeMax: string,
  calendarId = 'primary',
  maxResults = 100
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  const response = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`)
  
  if (!response.ok) {
    const error = await response.text()
    logger.error('Failed to list calendar events', { error, status: response.status })
    throw new Error(`Failed to list events: ${response.status}`)
  }

  const data = await response.json() as { items: CalendarEvent[] }
  return data.items || []
}

/**
 * Create a new calendar event
 */
export async function createEvent(
  userId: number,
  input: CalendarEventInput,
  calendarId = 'primary'
): Promise<CalendarEvent> {
  const eventBody: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: input.allDay
      ? { date: input.startTime.split('T')[0] }
      : { dateTime: input.startTime, timeZone: input.timeZone || 'Europe/Madrid' },
    end: input.allDay
      ? { date: input.endTime.split('T')[0] }
      : { dateTime: input.endTime, timeZone: input.timeZone || 'Europe/Madrid' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'email', minutes: 60 },
      ],
    },
  }

  if (input.attendeeEmails?.length) {
    eventBody.attendees = input.attendeeEmails.map(email => ({ email }))
  }

  // Store inmobiliaria metadata in extended properties
  if (input.propertyId || input.clientId || input.eventType) {
    eventBody.extendedProperties = {
      private: {
        ...(input.propertyId && { propertyId: String(input.propertyId) }),
        ...(input.clientId && { clientId: String(input.clientId) }),
        ...(input.eventType && { eventType: input.eventType }),
        source: 'inmobiliaria',
      },
    }
  }

  // Color coding by event type
  const colorMap: Record<string, string> = {
    viewing: '9',   // Blueberry
    meeting: '5',   // Banana
    signing: '10',  // Sage
    other: '8',     // Graphite
  }
  if (input.eventType && colorMap[input.eventType]) {
    eventBody.colorId = colorMap[input.eventType]
  }

  const response = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(eventBody),
  })

  if (!response.ok) {
    const error = await response.text()
    logger.error('Failed to create calendar event', { error })
    throw new Error(`Failed to create event: ${response.status}`)
  }

  const event = await response.json() as CalendarEvent
  
  // Cache the event locally
  await cacheEvent(userId, event, input, calendarId)
  
  return event
}

/**
 * Update an existing calendar event
 */
export async function updateEvent(
  userId: number,
  eventId: string,
  input: Partial<CalendarEventInput>,
  calendarId = 'primary'
): Promise<CalendarEvent> {
  // First get existing event
  const getResponse = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`)
  if (!getResponse.ok) throw new Error(`Event not found: ${eventId}`)
  
  const existing = await getResponse.json() as CalendarEvent

  const updateBody: Record<string, unknown> = { ...existing }
  
  if (input.summary !== undefined) updateBody.summary = input.summary
  if (input.description !== undefined) updateBody.description = input.description
  if (input.location !== undefined) updateBody.location = input.location
  if (input.startTime) {
    updateBody.start = input.allDay
      ? { date: input.startTime.split('T')[0] }
      : { dateTime: input.startTime, timeZone: input.timeZone || 'Europe/Madrid' }
  }
  if (input.endTime) {
    updateBody.end = input.allDay
      ? { date: input.endTime.split('T')[0] }
      : { dateTime: input.endTime, timeZone: input.timeZone || 'Europe/Madrid' }
  }

  const response = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(updateBody),
  })

  if (!response.ok) {
    const error = await response.text()
    logger.error('Failed to update calendar event', { error })
    throw new Error(`Failed to update event: ${response.status}`)
  }

  return await response.json() as CalendarEvent
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(
  userId: number,
  eventId: string,
  calendarId = 'primary'
): Promise<void> {
  const response = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'DELETE',
  })

  if (!response.ok && response.status !== 410) {
    throw new Error(`Failed to delete event: ${response.status}`)
  }

  // Remove from cache
  const db = container.getDatabase()
  await db`DELETE FROM calendar_events_cache WHERE user_id = ${userId} AND google_event_id = ${eventId}`
}

/**
 * Check if user has Google Calendar connected
 */
export async function getConnectionStatus(userId: number): Promise<{ connected: boolean; email?: string }> {
  const tokens = await getTokens(userId)
  if (!tokens) return { connected: false }

  try {
    // Verify token is still valid by making a simple API call
    const response = await calendarFetch(userId, '/calendars/primary')
    if (response.ok) {
      const cal = await response.json() as { summary: string }
      return { connected: true, email: cal.summary }
    }
    return { connected: false }
  } catch {
    return { connected: false }
  }
}

// =============================================================================
// Cache Management
// =============================================================================

async function cacheEvent(
  userId: number,
  event: CalendarEvent,
  input: CalendarEventInput,
  calendarId: string
): Promise<void> {
  try {
    const db = container.getDatabase()
    const startTime = 'dateTime' in event.start ? event.start.dateTime : event.start.date
    const endTime = 'dateTime' in event.end ? event.end.dateTime : event.end.date
    const allDay = 'date' in event.start

    await db`
      INSERT INTO calendar_events_cache 
        (user_id, google_event_id, calendar_id, summary, description, location, 
         start_time, end_time, all_day, status, property_id, client_id, event_type, html_link, synced_at)
      VALUES 
        (${userId}, ${event.id!}, ${calendarId}, ${event.summary}, ${event.description || null}, 
         ${event.location || null}, ${startTime}, ${endTime}, ${allDay}, ${event.status || 'confirmed'},
         ${input.propertyId || null}, ${input.clientId || null}, ${input.eventType || 'other'},
         ${event.htmlLink || null}, NOW())
      ON CONFLICT (user_id, google_event_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        description = EXCLUDED.description,
        location = EXCLUDED.location,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        all_day = EXCLUDED.all_day,
        status = EXCLUDED.status,
        property_id = EXCLUDED.property_id,
        client_id = EXCLUDED.client_id,
        event_type = EXCLUDED.event_type,
        html_link = EXCLUDED.html_link,
        synced_at = NOW(),
        updated_at = NOW()
    `
  } catch (error) {
    logger.warn('Failed to cache calendar event', { error, eventId: event.id })
  }
}

/**
 * Sync events from Google Calendar to local cache
 */
export async function syncEventsToCache(
  userId: number,
  timeMin: string,
  timeMax: string,
  calendarId = 'primary'
): Promise<CalendarEvent[]> {
  const events = await listEvents(userId, timeMin, timeMax, calendarId)
  const db = container.getDatabase()

  for (const event of events) {
    if (!event.id) continue
    const startTime = 'dateTime' in event.start ? event.start.dateTime : (event.start as { date: string }).date
    const endTime = 'dateTime' in event.end ? event.end.dateTime : (event.end as { date: string }).date
    const allDay = 'date' in event.start

    // Extract inmobiliaria metadata from extended properties
    const extProps = event.extendedProperties?.private || {}

    await db`
      INSERT INTO calendar_events_cache 
        (user_id, google_event_id, calendar_id, summary, description, location,
         start_time, end_time, all_day, status, property_id, client_id, event_type, html_link, synced_at)
      VALUES 
        (${userId}, ${event.id}, ${calendarId}, ${event.summary || ''}, ${event.description || null},
         ${event.location || null}, ${startTime}, ${endTime}, ${allDay}, ${event.status || 'confirmed'},
         ${extProps.propertyId ? Number(extProps.propertyId) : null},
         ${extProps.clientId ? Number(extProps.clientId) : null},
         ${extProps.eventType || 'other'},
         ${event.htmlLink || null}, NOW())
      ON CONFLICT (user_id, google_event_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        description = EXCLUDED.description,
        location = EXCLUDED.location,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        all_day = EXCLUDED.all_day,
        status = EXCLUDED.status,
        html_link = EXCLUDED.html_link,
        synced_at = NOW(),
        updated_at = NOW()
    `
  }

  return events
}
