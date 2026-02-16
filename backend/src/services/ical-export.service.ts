/**
 * @fileoverview iCal Export Service
 * Generates .ics files for mobile calendar sync (iOS/Android)
 */

import { container } from '../lib/container'

// =============================================================================
// Types
// =============================================================================

interface ICalEvent {
  uid: string
  summary: string
  description?: string
  location?: string
  startTime: Date
  endTime: Date
  allDay?: boolean
  organizer?: { name: string; email: string }
  attendees?: Array<{ name?: string; email: string }>
  reminders?: number[] // minutes before
  url?: string
}

// =============================================================================
// iCal Generation
// =============================================================================

function escapeIcal(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

/**
 * Generate a single .ics file for one event
 */
export function generateICS(event: ICalEvent): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inmobiliaria System//Calendar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
  ]

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.startTime)}`)
    lines.push(`DTEND;VALUE=DATE:${formatDateOnly(event.endTime)}`)
  } else {
    lines.push(`DTSTART:${formatDate(event.startTime)}`)
    lines.push(`DTEND:${formatDate(event.endTime)}`)
  }

  lines.push(`SUMMARY:${escapeIcal(event.summary)}`)

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcal(event.description)}`)
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcal(event.location)}`)
  }
  if (event.url) {
    lines.push(`URL:${event.url}`)
  }

  if (event.organizer) {
    lines.push(`ORGANIZER;CN=${escapeIcal(event.organizer.name)}:mailto:${event.organizer.email}`)
  }

  if (event.attendees) {
    for (const att of event.attendees) {
      const cn = att.name ? `;CN=${escapeIcal(att.name)}` : ''
      lines.push(`ATTENDEE${cn}:mailto:${att.email}`)
    }
  }

  // Reminders
  const reminders = event.reminders || [30, 60]
  for (const mins of reminders) {
    lines.push('BEGIN:VALARM')
    lines.push('ACTION:DISPLAY')
    lines.push(`DESCRIPTION:${escapeIcal(event.summary)}`)
    lines.push(`TRIGGER:-PT${mins}M`)
    lines.push('END:VALARM')
  }

  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

/**
 * Generate iCal feed for a user's events (subscribable URL)
 */
export async function generateUserFeed(userId: number, days = 90): Promise<string> {
  const db = container.getDatabase()
  
  const now = new Date()
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const events = await db`
    SELECT ce.*, c.full_name as client_name, c.email as client_email,
           p.address as property_address
    FROM calendar_events_cache ce
    LEFT JOIN clients c ON c.id = ce.client_id
    LEFT JOIN properties p ON p.id = ce.property_id
    WHERE ce.user_id = ${userId}
      AND ce.start_time >= ${pastDate.toISOString()}
      AND ce.start_time <= ${futureDate.toISOString()}
      AND ce.status != 'cancelled'
    ORDER BY ce.start_time ASC
  `

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inmobiliaria System//Calendar Feed//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Inmobiliaria - Mis Eventos',
    'X-WR-TIMEZONE:Europe/Madrid',
    // Timezone definition
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Madrid',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ]

  for (const ev of events) {
    const uid = `${ev.google_event_id || ev.id}@inmobiliaria.local`
    const start = new Date(ev.start_time as string)
    const end = new Date(ev.end_time as string)
    const allDay = ev.all_day as boolean

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${formatDate(new Date())}`)

    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(start)}`)
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(end)}`)
    } else {
      lines.push(`DTSTART;TZID=Europe/Madrid:${start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '')}`)
      lines.push(`DTEND;TZID=Europe/Madrid:${end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '')}`)
    }

    lines.push(`SUMMARY:${escapeIcal(ev.summary as string || 'Evento')}`)
    
    // Build description with context
    const descParts: string[] = []
    if (ev.description) descParts.push(ev.description as string)
    if (ev.client_name) descParts.push(`Cliente: ${ev.client_name}`)
    if (ev.event_type) descParts.push(`Tipo: ${ev.event_type}`)
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcal(descParts.join('\\n'))}`)
    }

    if (ev.location) lines.push(`LOCATION:${escapeIcal(ev.location as string)}`)
    if (ev.html_link) lines.push(`URL:${ev.html_link}`)

    // Color category based on event type
    const categories: Record<string, string> = {
      viewing: 'Visita', meeting: 'Reunión', signing: 'Firma', other: 'Otro'
    }
    if (ev.event_type && categories[ev.event_type as string]) {
      lines.push(`CATEGORIES:${categories[ev.event_type as string]}`)
    }

    // Reminders
    lines.push('BEGIN:VALARM')
    lines.push('ACTION:DISPLAY')
    lines.push(`DESCRIPTION:${escapeIcal(ev.summary as string || 'Evento')}`)
    lines.push('TRIGGER:-PT30M')
    lines.push('END:VALARM')

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/**
 * Generate a single-event .ics for download/share
 */
export async function generateEventICS(userId: number, eventId: string): Promise<string | null> {
  const db = container.getDatabase()
  
  const rows = await db`
    SELECT ce.*, c.full_name as client_name, c.email as client_email,
           u.email as agent_email
    FROM calendar_events_cache ce
    LEFT JOIN clients c ON c.id = ce.client_id
    LEFT JOIN users u ON u.id = ce.user_id
    WHERE ce.user_id = ${userId} AND ce.google_event_id = ${eventId}
    LIMIT 1
  `

  if (rows.length === 0) return null

  const ev = rows[0]
  return generateICS({
    uid: `${ev.google_event_id}@inmobiliaria.local`,
    summary: ev.summary as string || 'Evento',
    description: ev.description as string | undefined,
    location: ev.location as string | undefined,
    startTime: new Date(ev.start_time as string),
    endTime: new Date(ev.end_time as string),
    allDay: ev.all_day as boolean,
    attendees: ev.client_email ? [{ name: ev.client_name as string, email: ev.client_email as string }] : undefined,
    url: ev.html_link as string | undefined,
  })
}
