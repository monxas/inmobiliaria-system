<script lang="ts">
	import { onMount } from 'svelte';
	import { calendarStore, type CalendarEvent, type CalendarEventInput } from '$lib/stores/calendar';
	import { clientsApi, propertiesApi } from '$lib/api/client';
	import type { Client, Property } from '$lib/types';
	import { X, Trash2, Calendar, Clock, MapPin, Users, FileText, Tag, Building, User } from 'lucide-svelte';

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

	// Client & Property linking
	let selectedClientId = $state<number | null>(
		event?.extendedProperties?.private?.clientId ? Number(event.extendedProperties.private.clientId) : null
	);
	let selectedPropertyId = $state<number | null>(
		event?.extendedProperties?.private?.propertyId ? Number(event.extendedProperties.private.propertyId) : null
	);
	let clients = $state<Client[]>([]);
	let properties = $state<Property[]>([]);
	let clientSearch = $state('');
	let propertySearch = $state('');
	let loadingClients = $state(false);
	let loadingProperties = $state(false);

	// Date/time handling
	function getDefaultStart(): string {
		if (event?.start.dateTime) return toLocalDatetime(event.start.dateTime);
		if (event?.start.date) return event.start.date + 'T09:00';
		if (defaultDate) {
			const d = new Date(defaultDate);
			d.setHours(10, 0, 0, 0);
			return toLocalDatetime(d.toISOString());
		}
		const d = new Date();
		d.setHours(d.getHours() + 1, 0, 0, 0);
		return toLocalDatetime(d.toISOString());
	}

	function toLocalDatetime(iso: string): string {
		const d = new Date(iso);
		const offset = d.getTimezoneOffset();
		const local = new Date(d.getTime() - offset * 60000);
		return local.toISOString().slice(0, 16);
	}

	function getDefaultEnd(): string {
		if (event?.end.dateTime) return toLocalDatetime(event.end.dateTime);
		if (event?.end.date) return event.end.date + 'T10:00';
		const start = new Date(getDefaultStart());
		start.setHours(start.getHours() + 1);
		return toLocalDatetime(start.toISOString());
	}

	let startTime = $state(getDefaultStart());
	let endTime = $state(getDefaultEnd());
	let attendeeInput = $state('');
	let saving = $state(false);
	let deleting = $state(false);
	let error = $state('');

	const eventTypes = [
		{ value: 'viewing', label: '🏠 Visita', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
		{ value: 'meeting', label: '🤝 Reunión', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
		{ value: 'signing', label: '✍️ Firma', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
		{ value: 'other', label: '📅 Otro', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
	];

	// Auto-fill location when property is selected
	$effect(() => {
		if (selectedPropertyId) {
			const prop = properties.find((p) => p.id === selectedPropertyId);
			if (prop && !location) {
				location = `${prop.address}, ${prop.city}`;
			}
			if (prop && !summary) {
				const typeLabel = eventTypes.find(t => t.value === eventType)?.label || 'Evento';
				summary = `${typeLabel} - ${prop.title}`;
			}
		}
	});

	async function loadClients() {
		loadingClients = true;
		try {
			const res = await clientsApi.list(1, 50, clientSearch ? { search: clientSearch } : undefined);
			const d = res.data as any;
			clients = d?.items || (Array.isArray(d) ? d : []);
		} catch {
			clients = [];
		}
		loadingClients = false;
	}

	async function loadProperties() {
		loadingProperties = true;
		try {
			const res = await propertiesApi.list(1, 50, propertySearch ? { search: propertySearch } : undefined);
			const d = res.data as any;
			properties = d?.items || (Array.isArray(d) ? d : []);
		} catch {
			properties = [];
		}
		loadingProperties = false;
	}

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
			propertyId: selectedPropertyId || undefined,
			clientId: selectedClientId || undefined,
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

	onMount(() => {
		loadClients();
		loadProperties();
	});
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog">
	<!-- Click-away -->
	<button class="absolute inset-0" onclick={onClose} aria-label="Cerrar"></button>

	<!-- Modal -->
	<div
		class="relative w-full max-w-lg rounded-xl border bg-card shadow-2xl mx-4 max-h-[90vh] overflow-y-auto"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div class="sticky top-0 z-10 flex items-center justify-between border-b bg-card/95 backdrop-blur-sm p-4 rounded-t-xl">
			<h2 class="text-lg font-semibold">
				{isEdit ? 'Editar cita' : 'Nueva cita'}
			</h2>
			<div class="flex items-center gap-1">
				{#if isEdit}
					<button
						onclick={handleDelete}
						disabled={deleting}
						class="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors"
						title="Eliminar"
					>
						<Trash2 class="h-4 w-4" />
					</button>
				{/if}
				<button onclick={onClose} class="rounded-lg p-2 hover:bg-muted transition-colors">
					<X class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Form -->
		<div class="space-y-5 p-4">
			{#if error}
				<div class="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<!-- Event Type -->
			<div>
				<label class="mb-2 flex items-center gap-1.5 text-sm font-medium">
					<Tag class="h-4 w-4 text-muted-foreground" />
					Tipo de cita
				</label>
				<div class="flex flex-wrap gap-2">
					{#each eventTypes as type}
						<button
							onclick={() => (eventType = type.value as typeof eventType)}
							class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-all
								{eventType === type.value ? type.color + ' ring-2 ring-offset-2 ring-primary' : 'bg-muted hover:bg-muted/80'}"
						>
							{type.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Title -->
			<div>
				<label for="event-summary" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<Calendar class="h-4 w-4 text-muted-foreground" />
					Título *
				</label>
				<input
					id="event-summary"
					type="text"
					bind:value={summary}
					placeholder="Ej: Visita apartamento Calle Mayor 15"
					class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
				/>
			</div>

			<!-- Client Selector -->
			<div>
				<label class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<User class="h-4 w-4 text-muted-foreground" />
					Cliente
				</label>
				<select
					bind:value={selectedClientId}
					class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
				>
					<option value={null}>— Sin cliente —</option>
					{#each clients as client}
						<option value={client.id}>
							{client.fullName}{client.phone ? ` (${client.phone})` : ''}{client.email ? ` - ${client.email}` : ''}
						</option>
					{/each}
				</select>
				{#if loadingClients}
					<p class="text-xs text-muted-foreground mt-1">Cargando clientes...</p>
				{/if}
			</div>

			<!-- Property Selector -->
			<div>
				<label class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<Building class="h-4 w-4 text-muted-foreground" />
					Propiedad
				</label>
				<select
					bind:value={selectedPropertyId}
					class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
				>
					<option value={null}>— Sin propiedad —</option>
					{#each properties as prop}
						<option value={prop.id}>
							{prop.title} — {prop.address}, {prop.city} ({Number(prop.price).toLocaleString('es-ES')}€)
						</option>
					{/each}
				</select>
				{#if loadingProperties}
					<p class="text-xs text-muted-foreground mt-1">Cargando propiedades...</p>
				{/if}
			</div>

			<!-- Date/Time -->
			<div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="event-start" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
							<Clock class="h-4 w-4 text-muted-foreground" />
							Inicio
						</label>
						<input
							id="event-start"
							type="datetime-local"
							bind:value={startTime}
							class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
						/>
					</div>
					<div>
						<label for="event-end" class="mb-1.5 text-sm font-medium">Fin</label>
						<input
							id="event-end"
							type="datetime-local"
							bind:value={endTime}
							class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
						/>
					</div>
				</div>
				<label class="flex items-center gap-2 text-sm mt-2">
					<input type="checkbox" bind:checked={allDay} class="rounded border-border" />
					Todo el día
				</label>
			</div>

			<!-- Location -->
			<div>
				<label for="event-location" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<MapPin class="h-4 w-4 text-muted-foreground" />
					Ubicación
				</label>
				<input
					id="event-location"
					type="text"
					bind:value={location}
					placeholder="Dirección de la propiedad"
					class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="event-desc" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<FileText class="h-4 w-4 text-muted-foreground" />
					Notas
				</label>
				<textarea
					id="event-desc"
					bind:value={description}
					rows="3"
					placeholder="Detalles adicionales, notas para la visita..."
					class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-shadow"
				></textarea>
			</div>

			<!-- Attendees -->
			<div>
				<label for="event-attendees" class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
					<Users class="h-4 w-4 text-muted-foreground" />
					Asistentes (emails, separados por coma)
				</label>
				<input
					id="event-attendees"
					type="text"
					bind:value={attendeeInput}
					placeholder="cliente@email.com, agente@email.com"
					class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
				/>
			</div>
		</div>

		<!-- Footer -->
		<div class="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-card/95 backdrop-blur-sm p-4 rounded-b-xl">
			<button onclick={onClose} class="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
				Cancelar
			</button>
			<button
				onclick={handleSave}
				disabled={saving}
				class="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
			>
				{saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear cita'}
			</button>
		</div>
	</div>
</div>
