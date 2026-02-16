<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Calendar } from '@fullcalendar/core';
	import dayGridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import interactionPlugin from '@fullcalendar/interaction';
	import listPlugin from '@fullcalendar/list';
	import { calendarStore, type CalendarEvent } from '$lib/stores/calendar';

	interface Props {
		onDateClick: (date: Date) => void;
		onEventClick: (event: CalendarEvent) => void;
		onEventDrop: (eventId: string, newStart: string, newEnd: string) => void;
	}

	let { onDateClick, onEventClick, onEventDrop }: Props = $props();

	let calendarEl: HTMLDivElement;
	let calendar: Calendar | null = null;

	// Event type colors
	const typeColors: Record<string, { bg: string; border: string; text: string }> = {
		viewing: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
		meeting: { bg: '#f59e0b', border: '#d97706', text: '#ffffff' },
		signing: { bg: '#10b981', border: '#059669', text: '#ffffff' },
		other: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' },
	};

	function mapEventsToFC(events: CalendarEvent[]) {
		return events.map((e) => {
			const eventType = e.extendedProperties?.private?.eventType || 'other';
			const colors = typeColors[eventType] || typeColors.other;
			const clientName = e.extendedProperties?.private?.clientName;
			const propertyTitle = e.extendedProperties?.private?.propertyTitle;

			let title = e.summary;
			if (clientName) title += ` • ${clientName}`;

			return {
				id: e.id,
				title,
				start: e.start.dateTime || e.start.date,
				end: e.end.dateTime || e.end.date,
				allDay: !!e.start.date,
				backgroundColor: colors.bg,
				borderColor: colors.border,
				textColor: colors.text,
				extendedProps: {
					original: e,
					eventType,
					location: e.location,
					propertyTitle,
					clientName,
				},
			};
		});
	}

	// React to store changes
	$effect(() => {
		const events = $calendarStore.events;
		if (calendar) {
			const source = calendar.getEventSources()[0];
			if (source) source.remove();
			calendar.addEventSource(mapEventsToFC(events));
		}
	});

	onMount(() => {
		calendar = new Calendar(calendarEl, {
			plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
			initialView: 'dayGridMonth',
			locale: 'es',
			firstDay: 1, // Monday
			height: 'auto',
			headerToolbar: {
				left: 'prev,next today',
				center: 'title',
				right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
			},
			buttonText: {
				today: 'Hoy',
				month: 'Mes',
				week: 'Semana',
				day: 'Día',
				list: 'Lista',
			},
			editable: true,
			selectable: true,
			selectMirror: true,
			dayMaxEvents: 3,
			moreLinkText: (n) => `+${n} más`,
			nowIndicator: true,
			eventTimeFormat: {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			},
			slotLabelFormat: {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			},
			slotMinTime: '07:00:00',
			slotMaxTime: '22:00:00',
			businessHours: {
				daysOfWeek: [1, 2, 3, 4, 5],
				startTime: '09:00',
				endTime: '20:00',
			},

			dateClick: (info) => {
				onDateClick(info.date);
			},

			eventClick: (info) => {
				info.jsEvent.preventDefault();
				const original = info.event.extendedProps.original as CalendarEvent;
				if (original) onEventClick(original);
			},

			eventDrop: (info) => {
				const id = info.event.id;
				const start = info.event.start?.toISOString();
				const end = info.event.end?.toISOString() || start;
				if (id && start && end) onEventDrop(id, start, end);
			},

			eventResize: (info) => {
				const id = info.event.id;
				const start = info.event.start?.toISOString();
				const end = info.event.end?.toISOString() || start;
				if (id && start && end) onEventDrop(id, start, end);
			},

			datesSet: (info) => {
				calendarStore.fetchEvents(info.startStr, info.endStr);
			},

			eventDidMount: (info) => {
				const loc = info.event.extendedProps.location;
				if (loc) {
					info.el.title = `${info.event.title}\n📍 ${loc}`;
				}
			},
		});

		calendar.render();
	});

	onDestroy(() => {
		calendar?.destroy();
	});
</script>

<div class="fc-container">
	<div bind:this={calendarEl}></div>
</div>

<style>
	/* FullCalendar theme overrides for dark/light mode */
	.fc-container :global(.fc) {
		--fc-border-color: hsl(var(--border));
		--fc-page-bg-color: transparent;
		--fc-neutral-bg-color: hsl(var(--muted));
		--fc-today-bg-color: hsl(var(--primary) / 0.05);
		--fc-event-border-color: transparent;
		font-family: 'Inter', sans-serif;
	}

	.fc-container :global(.fc .fc-toolbar-title) {
		font-size: 1.125rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.fc-container :global(.fc .fc-button) {
		background-color: hsl(var(--muted));
		border: 1px solid hsl(var(--border));
		color: hsl(var(--foreground));
		font-size: 0.8125rem;
		font-weight: 500;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		text-transform: none;
	}

	.fc-container :global(.fc .fc-button:hover) {
		background-color: hsl(var(--muted) / 0.8);
	}

	.fc-container :global(.fc .fc-button-active),
	.fc-container :global(.fc .fc-button:active) {
		background-color: hsl(var(--primary)) !important;
		color: hsl(var(--primary-foreground)) !important;
		border-color: hsl(var(--primary)) !important;
	}

	.fc-container :global(.fc-theme-standard td),
	.fc-container :global(.fc-theme-standard th) {
		border-color: hsl(var(--border));
	}

	.fc-container :global(.fc .fc-daygrid-day-number),
	.fc-container :global(.fc .fc-col-header-cell-cushion) {
		color: hsl(var(--foreground));
		text-decoration: none;
		font-size: 0.8125rem;
	}

	.fc-container :global(.fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number) {
		background-color: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-radius: 9999px;
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.fc-container :global(.fc .fc-event) {
		border-radius: 0.25rem;
		font-size: 0.75rem;
		padding: 1px 4px;
		cursor: pointer;
	}

	.fc-container :global(.fc .fc-daygrid-event) {
		margin: 1px 2px;
	}

	.fc-container :global(.fc .fc-timegrid-event) {
		border-radius: 0.375rem;
		padding: 2px 4px;
	}

	.fc-container :global(.fc .fc-more-link) {
		color: hsl(var(--primary));
		font-size: 0.75rem;
		font-weight: 500;
	}

	.fc-container :global(.fc .fc-toolbar) {
		padding: 0.75rem 1rem;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.fc-container :global(.fc .fc-toolbar) {
			flex-direction: column;
			gap: 0.5rem;
		}

		.fc-container :global(.fc .fc-toolbar-title) {
			font-size: 1rem;
		}

		.fc-container :global(.fc .fc-button) {
			font-size: 0.75rem;
			padding: 0.25rem 0.5rem;
		}

		.fc-container :global(.fc .fc-daygrid-day) {
			min-height: 60px;
		}
	}

	/* List view styling */
	.fc-container :global(.fc .fc-list-event-title a) {
		color: hsl(var(--foreground));
		text-decoration: none;
	}

	.fc-container :global(.fc .fc-list-day-cushion) {
		background-color: hsl(var(--muted));
	}
</style>
