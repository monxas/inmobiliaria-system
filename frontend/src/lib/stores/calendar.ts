/**
 * Calendar store - manages Google Calendar state
 */
import { writable, derived } from 'svelte/store';
import { API_BASE } from '$lib/config';

// =============================================================================
// Types
// =============================================================================

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink?: string;
  status?: string;
  colorId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  timeZone?: string;
  propertyId?: number;
  clientId?: number;
  eventType?: 'viewing' | 'meeting' | 'signing' | 'other';
  attendeeEmails?: string[];
}

interface CalendarState {
  connected: boolean;
  email: string | null;
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
}

// =============================================================================
// Store
// =============================================================================

function createCalendarStore() {
  const { subscribe, set, update } = writable<CalendarState>({
    connected: false,
    email: null,
    events: [],
    loading: false,
    error: null,
  });

  function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function checkStatus() {
    try {
      const res = await fetch(`${API_BASE}/calendar/status`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        update((s) => ({ ...s, connected: data.data.connected, email: data.data.email || null }));
      }
    } catch (err) {
      update((s) => ({ ...s, error: 'Failed to check calendar status' }));
    }
  }

  async function connect() {
    try {
      const res = await fetch(`${API_BASE}/calendar/auth/url`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        // Redirect to Google consent page
        window.location.href = data.data.url;
      }
    } catch (err) {
      update((s) => ({ ...s, error: 'Failed to start Google Calendar connection' }));
    }
  }

  async function disconnect() {
    try {
      await fetch(`${API_BASE}/calendar/disconnect`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      update((s) => ({ ...s, connected: false, email: null, events: [] }));
    } catch (err) {
      update((s) => ({ ...s, error: 'Failed to disconnect' }));
    }
  }

  async function fetchEvents(timeMin?: string, timeMax?: string) {
    update((s) => ({ ...s, loading: true, error: null }));
    try {
      const params = new URLSearchParams();
      if (timeMin) params.set('timeMin', timeMin);
      if (timeMax) params.set('timeMax', timeMax);

      const res = await fetch(`${API_BASE}/calendar/events?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        update((s) => ({ ...s, events: data.data.events, loading: false }));
        return data.data.events;
      } else {
        update((s) => ({ ...s, error: data.error?.message, loading: false }));
      }
    } catch (err) {
      update((s) => ({ ...s, error: 'Failed to fetch events', loading: false }));
    }
    return [];
  }

  async function createEvent(input: CalendarEventInput): Promise<CalendarEvent | null> {
    try {
      const res = await fetch(`${API_BASE}/calendar/events`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (data.success) {
        update((s) => ({ ...s, events: [...s.events, data.data.event] }));
        return data.data.event;
      } else {
        update((s) => ({ ...s, error: data.error?.message }));
      }
    } catch (err) {
      update((s) => ({ ...s, error: 'Failed to create event' }));
    }
    return null;
  }

  async function updateEvent(eventId: string, input: Partial<CalendarEventInput>): Promise<CalendarEvent | null> {
    try {
      const res = await fetch(`${API_BASE}/calendar/events/${eventId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (data.success) {
        update((s) => ({
          ...s,
          events: s.events.map((e) => (e.id === eventId ? data.data.event : e)),
        }));
        return data.data.event;
      }
    } catch (err) {
      update((s) => ({ ...s, error: 'Failed to update event' }));
    }
    return null;
  }

  async function deleteEvent(eventId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/calendar/events/${eventId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        update((s) => ({ ...s, events: s.events.filter((e) => e.id !== eventId) }));
        return true;
      }
    } catch (err) {
      update((s) => ({ ...s, error: 'Failed to delete event' }));
    }
    return false;
  }

  return {
    subscribe,
    checkStatus,
    connect,
    disconnect,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}

export const calendarStore = createCalendarStore();
