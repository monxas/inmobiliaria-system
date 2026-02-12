<script lang="ts">
	import { calendarStore, type CalendarEvent, type CalendarEventInput } from '$stores/calendar';
	import { X, Trash2, Calendar, Clock, MapPin, Users, FileText, Tag } from 'lucide-svelte';

	interface Props {
		event?: CalendarEvent | null;
		defaultDate?: Date | null;
		onClose: () => void;
		onSave: () => void;
	}

	let { event = null, defaultDate = null, onClose, onSave }: Props = $props();

	const isEdit = !!event?.id;

	// Form state
	let summary = $state(event?.summary || '');
	let description = $state(event?.description || '');
	let location = $state(event?.location || '');
	let eventType = $state<'viewing' | 'meeting' | 'signing' | 'other'>(
		(event?.extendedProperties?.private?.eventType as 'viewing') || 'viewing'
	);
	let allDay = $state(event ? !!event.start.date : false);
	
	// Date/time handling
	function getDefaultStart(): string {
		if (event?.start.dateTime) return event.start.dateTime.slice(0, 16);
		if (event?.start.date) return event.start.date + 'T09:00';
		if (defaultDate) {
			const d = new Date(defaultDate);
			d.setHours(10, 0, 0, 0);
			return d.toISOString().slice(0, 16);
		}
		const d = new Date();
		d.setHours(d.getHours() + 1, 0, 0, 0);
		return d.toISOString().slice(0, 16);
	}

	function getDefaultEnd(): string {
		if (event?.end.dateTime) return event.end.dateTime.slice(0, 16);
		if (event?.end.date) return event.end.date + 'T10:00';
		const start = new Date(getDefaultStart());
		start.setHours(start.getHours() + 1);
		return start.toISOString().slice(0, 16);
	}

	let startTime = $state(getDefaultStart());
	let endTime = $state(getDefaultEnd());
	let attendeeInput = $state('');
	let saving = $state(false);
	let deleting = $state(false);
	let error = $state('');

	const eventTypes = [
		{ value: 'viewing', label: '🏠 Visita', color: 'bg-blue-100 text-blue-800' },
		{ value: 'meeting', label: '🤝 Reunión', color: 'bg-yellow-100 text-yellow-800' },
		{ value: 'signing', label: '✍️ Firma', color: 'bg-green-100 text-green-800' },
		{ value: 'other', label: '📅 Otro', color: 'bg-gray-100 text-gray-800' },
	];

	async function handleSave() {
		if (!summary.trim()) {
			error = 'El título es obligatorio';
			return;
		}

		saving = true;
		error = '';

		const input: CalendarEventInput = {
			summary: summary.trim(),
			description: description.trim() || undefined,
			location: location.trim() || undefined,
			startTime: new Date(startTime).toISOString(),
			endTime: new Date(endTime).toISOString(),
			allDay,
			eventType,
			attendeeEmails: attendeeInput
				.split(',')
				.map((e) => e.trim())
				.filter((e) => e.includes('@')),
		};

		try {
			if (isEdit && event?.id) {
				await calendarStore.updateEvent(event.id, input);
			} else {
				await calendarStore.createEvent(input);
			}
			onSave();
		} catch (err) {
			error = 'Error al guardar el evento';
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!event?.id || !confirm('¿Eliminar esta cita? Se eliminará también de Google Calendar.')) return;
		deleting = true;
		try {
			await calendarStore.deleteEvent(event.id);
			onSave();
		} catch {
			error = 'Error al eliminar';
		} finally {
			deleting = false;
		}
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onclick={onClose}>
	<!-- Modal -->
	<div
		class="w-full max-w-lg rounded-lg border bg-card shadow-xl mx-4 max-h-[90vh] overflow-y-auto"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b p-4">
			<h2 class="text-lg font-semibold">
				{isEdit ? 'Editar cita' : 'Nueva cita'}
			</h2>
			<div class="flex items-center gap-2">
				{#if isEdit}
					<button
						onclick={handleDelete}
						disabled={deleting}
						class="rounded-md p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
						title="Eliminar"
					>
						<Trash2 class="h-4 w-4" />
					</button>
				{/if}
				<button onclick={onClose} class="rounded-md p-2 hover:bg-muted transition-colors">
					<X class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Form -->
		<div class="space-y-4 p-4">
			{#if error}
				<div class="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
					{error}
				</div>
			{/if}

			<!-- Event Type -->
			<div>
				<label class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<Tag class="h-4 w-4" />
					Tipo de cita
				</label>
				<div class="flex flex-wrap gap-2">
					{#each eventTypes as type}
						<button
							onclick={() => (eventType = type.value as typeof eventType)}
							class="rounded-full px-3 py-1 text-sm transition-all
								{eventType === type.value ? type.color + ' ring-2 ring-offset-1 ring-primary' : 'bg-muted hover:bg-muted/80'}"
						>
							{type.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Title -->
			<div>
				<label for="event-summary" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<Calendar class="h-4 w-4" />
					Título *
				</label>
				<input
					id="event-summary"
					type="text"
					bind:value={summary}
					placeholder="Ej: Visita apartamento Calle Mayor 15"
					class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>

			<!-- Date/Time -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="event-start" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
						<Clock class="h-4 w-4" />
						Inicio
					</label>
					<input
						id="event-start"
						type="datetime-local"
						bind:value={startTime}
						class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
				<div>
					<label for="event-end" class="mb-1.5 text-sm font-medium">Fin</label>
					<input
						id="event-end"
						type="datetime-local"
						bind:value={endTime}
						class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
			</div>

			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={allDay} class="rounded" />
				Todo el día
			</label>

			<!-- Location -->
			<div>
				<label for="event-location" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<MapPin class="h-4 w-4" />
					Ubicación
				</label>
				<input
					id="event-location"
					type="text"
					bind:value={location}
					placeholder="Dirección de la propiedad"
					class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="event-desc" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<FileText class="h-4 w-4" />
					Notas
				</label>
				<textarea
					id="event-desc"
					bind:value={description}
					rows="3"
					placeholder="Detalles adicionales, notas para la visita..."
					class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
				></textarea>
			</div>

			<!-- Attendees -->
			<div>
				<label for="event-attendees" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<Users class="h-4 w-4" />
					Asistentes (emails separados por coma)
				</label>
				<input
					id="event-attendees"
					type="text"
					bind:value={attendeeInput}
					placeholder="cliente@email.com, agente@email.com"
					class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-end gap-3 border-t p-4">
			<button onclick={onClose} class="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors">
				Cancelar
			</button>
			<button
				onclick={handleSave}
				disabled={saving}
				class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
			>
				{saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear cita'}
			</button>
		</div>
	</div>
</div>
