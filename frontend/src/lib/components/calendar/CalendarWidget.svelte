<script lang="ts">
	import { onMount } from 'svelte';
	import { calendarStore, type CalendarEvent } from '$stores/calendar';
	import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, ExternalLink } from 'lucide-svelte';
	import EventModal from './EventModal.svelte';

	// State
	let currentDate = $state(new Date());
	let viewMode = $state<'month' | 'week'>('month');
	let showEventModal = $state(false);
	let selectedEvent = $state<CalendarEvent | null>(null);
	let selectedDate = $state<Date | null>(null);

	// Derived
	let year = $derived(currentDate.getFullYear());
	let month = $derived(currentDate.getMonth());
	let monthName = $derived(currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
	
	let calendarDays = $derived.by(() => {
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const startOffset = (firstDay.getDay() + 6) % 7; // Monday start
		const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = [];

		// Previous month padding
		for (let i = startOffset - 1; i >= 0; i--) {
			const d = new Date(year, month, -i);
			days.push({ date: d, isCurrentMonth: false, isToday: false });
		}

		// Current month
		const today = new Date();
		for (let d = 1; d <= lastDay.getDate(); d++) {
			const date = new Date(year, month, d);
			days.push({
				date,
				isCurrentMonth: true,
				isToday: date.toDateString() === today.toDateString(),
			});
		}

		// Next month padding
		const remaining = 42 - days.length;
		for (let d = 1; d <= remaining; d++) {
			days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false, isToday: false });
		}

		return days;
	});

	function getEventsForDate(date: Date): CalendarEvent[] {
		const dateStr = date.toISOString().split('T')[0];
		return ($calendarStore.events || []).filter((event) => {
			const eventDate = event.start.dateTime
				? event.start.dateTime.split('T')[0]
				: event.start.date;
			return eventDate === dateStr;
		});
	}

	function navigate(direction: number) {
		currentDate = new Date(year, month + direction, 1);
		loadEvents();
	}

	function goToToday() {
		currentDate = new Date();
		loadEvents();
	}

	function loadEvents() {
		const timeMin = new Date(year, month, 1).toISOString();
		const timeMax = new Date(year, month + 2, 0).toISOString();
		calendarStore.fetchEvents(timeMin, timeMax);
	}

	function openNewEvent(date?: Date) {
		selectedEvent = null;
		selectedDate = date || new Date();
		showEventModal = true;
	}

	function openEditEvent(event: CalendarEvent) {
		selectedEvent = event;
		selectedDate = null;
		showEventModal = true;
	}

	function getEventColor(event: CalendarEvent): string {
		const type = event.extendedProperties?.private?.eventType;
		switch (type) {
			case 'viewing': return 'bg-blue-500';
			case 'meeting': return 'bg-yellow-500';
			case 'signing': return 'bg-green-500';
			default: return 'bg-gray-500';
		}
	}

	function formatTime(event: CalendarEvent): string {
		if (event.start.date) return 'Todo el día';
		const dt = event.start.dateTime;
		if (!dt) return '';
		return new Date(dt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
	}

	const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

	onMount(() => {
		calendarStore.checkStatus();
		loadEvents();
	});
</script>

<div class="rounded-lg border bg-card shadow-sm">
	<!-- Header -->
	<div class="flex items-center justify-between border-b p-4">
		<div class="flex items-center gap-3">
			<Calendar class="h-5 w-5 text-primary" />
			<h2 class="text-lg font-semibold capitalize">{monthName}</h2>
		</div>
		<div class="flex items-center gap-2">
			<button onclick={() => goToToday()} class="rounded-md border px-3 py-1 text-sm hover:bg-muted transition-colors">
				Hoy
			</button>
			<button onclick={() => navigate(-1)} class="rounded-md p-1 hover:bg-muted transition-colors">
				<ChevronLeft class="h-5 w-5" />
			</button>
			<button onclick={() => navigate(1)} class="rounded-md p-1 hover:bg-muted transition-colors">
				<ChevronRight class="h-5 w-5" />
			</button>
			{#if $calendarStore.connected}
				<button onclick={() => openNewEvent()} class="ml-2 flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 transition-colors">
					<Plus class="h-4 w-4" />
					Nueva cita
				</button>
			{/if}
		</div>
	</div>

	<!-- Connection status -->
	{#if !$calendarStore.connected}
		<div class="border-b bg-yellow-50 dark:bg-yellow-950 p-3">
			<div class="flex items-center justify-between">
				<p class="text-sm text-yellow-800 dark:text-yellow-200">
					Google Calendar no conectado. Conecta tu cuenta para ver y gestionar citas.
				</p>
				<button
					onclick={() => calendarStore.connect()}
					class="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
				>
					Conectar Google Calendar
				</button>
			</div>
		</div>
	{/if}

	<!-- Loading -->
	{#if $calendarStore.loading}
		<div class="flex items-center justify-center py-8">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
			<span class="ml-2 text-sm text-muted-foreground">Cargando eventos...</span>
		</div>
	{/if}

	<!-- Calendar Grid -->
	<div class="p-2">
		<!-- Day headers -->
		<div class="grid grid-cols-7 mb-1">
			{#each dayNames as day}
				<div class="py-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
			{/each}
		</div>

		<!-- Day cells -->
		<div class="grid grid-cols-7 gap-px">
			{#each calendarDays as { date, isCurrentMonth, isToday }}
				{@const dayEvents = getEventsForDate(date)}
				<button
					onclick={() => openNewEvent(date)}
					class="min-h-[80px] rounded-md p-1 text-left transition-colors hover:bg-muted/50
						{isCurrentMonth ? '' : 'opacity-40'}
						{isToday ? 'bg-primary/10 ring-1 ring-primary' : ''}"
				>
					<span class="text-xs font-medium {isToday ? 'text-primary font-bold' : 'text-muted-foreground'}">
						{date.getDate()}
					</span>
					<div class="mt-0.5 space-y-0.5">
						{#each dayEvents.slice(0, 3) as event}
							<button
								onclick={(e) => { e.stopPropagation(); openEditEvent(event); }}
								class="flex w-full items-center gap-1 rounded px-1 py-0.5 text-xs text-white truncate {getEventColor(event)} hover:opacity-80 transition-opacity"
							>
								<span class="truncate">{formatTime(event)} {event.summary}</span>
							</button>
						{/each}
						{#if dayEvents.length > 3}
							<span class="text-[10px] text-muted-foreground">+{dayEvents.length - 3} más</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Upcoming Events Sidebar -->
	{#if $calendarStore.connected && $calendarStore.events.length > 0}
		<div class="border-t p-4">
			<h3 class="mb-3 text-sm font-semibold text-muted-foreground">Próximas citas</h3>
			<div class="space-y-2 max-h-48 overflow-y-auto">
				{#each $calendarStore.events
					.filter((e) => {
						const dt = e.start.dateTime || e.start.date || '';
						return new Date(dt) >= new Date();
					})
					.slice(0, 5) as event}
					<button onclick={() => openEditEvent(event)} class="flex w-full items-start gap-3 rounded-md p-2 hover:bg-muted transition-colors text-left">
						<div class="mt-0.5 h-2 w-2 rounded-full {getEventColor(event)} flex-shrink-0"></div>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium truncate">{event.summary}</p>
							<div class="flex items-center gap-2 text-xs text-muted-foreground">
								<Clock class="h-3 w-3" />
								<span>{formatTime(event)}</span>
								{#if event.start.dateTime}
									<span>{new Date(event.start.dateTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
								{/if}
							</div>
							{#if event.location}
								<div class="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
									<MapPin class="h-3 w-3" />
									<span class="truncate">{event.location}</span>
								</div>
							{/if}
						</div>
						{#if event.htmlLink}
							<a href={event.htmlLink} target="_blank" rel="noopener" onclick={(e) => e.stopPropagation()} class="text-muted-foreground hover:text-primary">
								<ExternalLink class="h-3 w-3" />
							</a>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Event Modal -->
{#if showEventModal}
	<EventModal
		event={selectedEvent}
		defaultDate={selectedDate}
		onClose={() => { showEventModal = false; selectedEvent = null; }}
		onSave={() => { showEventModal = false; selectedEvent = null; loadEvents(); }}
	/>
{/if}
