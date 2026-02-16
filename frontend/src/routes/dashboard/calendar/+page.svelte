<script lang="ts">
	import { onMount } from 'svelte';
	import { calendarStore } from '$lib/stores/calendar';
	import FullCalendarView from '$lib/components/calendar/FullCalendarView.svelte';
	import EventModal from '$lib/components/calendar/EventModal.svelte';
	import type { CalendarEvent } from '$lib/stores/calendar';
	import { Calendar, Link2 } from 'lucide-svelte';

	let showEventModal = $state(false);
	let selectedEvent = $state<CalendarEvent | null>(null);
	let selectedDate = $state<Date | null>(null);

	function handleDateClick(date: Date) {
		selectedEvent = null;
		selectedDate = date;
		showEventModal = true;
	}

	function handleEventClick(event: CalendarEvent) {
		selectedEvent = event;
		selectedDate = null;
		showEventModal = true;
	}

	function handleEventDrop(eventId: string, newStart: string, newEnd: string) {
		calendarStore.updateEvent(eventId, {
			summary: '', // will be ignored by backend if empty - we just need the times
			startTime: newStart,
			endTime: newEnd,
		});
	}

	function handleModalClose() {
		showEventModal = false;
		selectedEvent = null;
		selectedDate = null;
	}

	function handleModalSave() {
		showEventModal = false;
		selectedEvent = null;
		selectedDate = null;
	}

	onMount(() => {
		calendarStore.checkStatus();
	});
</script>

<svelte:head>
	<title>Calendario | Inmobiliaria</title>
</svelte:head>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">
				<Calendar class="h-6 w-6 text-primary" />
				Calendario
			</h1>
			<p class="text-sm text-muted-foreground mt-1">Gestiona visitas, reuniones y firmas</p>
		</div>
		<div class="flex items-center gap-2">
			{#if $calendarStore.connected}
				<span class="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 px-3 py-1.5 rounded-full">
					<span class="h-2 w-2 rounded-full bg-green-500"></span>
					{$calendarStore.email}
				</span>
			{:else}
				<button
					onclick={() => calendarStore.connect()}
					class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					<Link2 class="h-4 w-4" />
					Conectar Google Calendar
				</button>
			{/if}
		</div>
	</div>

	<!-- Calendar -->
	<div class="rounded-lg border bg-card shadow-sm overflow-hidden">
		<FullCalendarView
			onDateClick={handleDateClick}
			onEventClick={handleEventClick}
			onEventDrop={handleEventDrop}
		/>
	</div>
</div>

{#if showEventModal}
	<EventModal
		event={selectedEvent}
		defaultDate={selectedDate}
		onClose={handleModalClose}
		onSave={handleModalSave}
	/>
{/if}
