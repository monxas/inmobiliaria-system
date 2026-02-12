<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { clients, CLIENT_STATUSES, CONTACT_TYPES, type ContactEntry, type ContactType } from '$stores/clients';
	import type { Client, ClientInput, Property } from '$types';
	import Button from '$ui/Button.svelte';
	import Badge from '$ui/Badge.svelte';
	import Card from '$ui/Card.svelte';
	import Modal from '$ui/Modal.svelte';
	import Input from '$ui/Input.svelte';
	import Select from '$ui/Select.svelte';
	import ClientForm from '$lib/components/forms/ClientForm.svelte';
	import { formatDate, formatDateTime, formatCurrency } from '$lib/utils';
	import { toast } from '$stores/toast';

	let client = $state<Client | null>(null);
	let loading = $state(true);
	let isEditing = $state(false);
	let saving = $state(false);
	let deleteModalOpen = $state(false);
	let contactModalOpen = $state(false);
	let activeTab = $state<'details' | 'properties' | 'history' | 'notes'>('details');

	// Properties viewed by this client
	let viewedProperties = $state<Property[]>([]);

	// Contact history (stored in notes as JSON)
	let contactHistory = $state<ContactEntry[]>([]);
	let newContactType = $state<string>('call');
	let newContactSummary = $state('');
	let newContactDetails = $state('');

	const contactTypeOptions = CONTACT_TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` }));

	function parseNotesData(notes: string | null | undefined): { text: string; contactHistory: ContactEntry[] } {
		if (!notes) return { text: '', contactHistory: [] };
		try {
			const parsed = JSON.parse(notes);
			return { text: parsed.text || '', contactHistory: parsed.contactHistory || [] };
		} catch {
			return { text: notes, contactHistory: [] };
		}
	}

	async function loadClient() {
		const id = Number($page.params.id);
		if (isNaN(id)) { goto('/dashboard/clients'); return; }
		
		loading = true;
		client = await clients.fetchClient(id);
		loading = false;

		if (!client) { goto('/dashboard/clients'); return; }

		const parsed = parseNotesData(client.notes);
		contactHistory = parsed.contactHistory;
	}

	async function handleUpdate(data: ClientInput) {
		if (!client) return;
		saving = true;
		const result = await clients.updateClient(client.id, data);
		saving = false;
		if (result) {
			client = result;
			isEditing = false;
			const parsed = parseNotesData(result.notes);
			contactHistory = parsed.contactHistory;
		}
	}

	async function handleDelete() {
		if (!client) return;
		const success = await clients.deleteClient(client.id);
		if (success) goto('/dashboard/clients');
		deleteModalOpen = false;
	}

	function addContactEntry() {
		if (!newContactSummary.trim()) {
			toast.warning('Escribe un resumen del contacto');
			return;
		}
		const entry: ContactEntry = {
			id: Math.random().toString(36).substring(2, 9),
			type: newContactType as ContactType,
			date: new Date().toISOString(),
			summary: newContactSummary,
			details: newContactDetails || undefined
		};
		contactHistory = [entry, ...contactHistory];
		newContactSummary = '';
		newContactDetails = '';
		contactModalOpen = false;

		// Persist to notes
		if (client) {
			const parsed = parseNotesData(client.notes);
			parsed.contactHistory = contactHistory;
			clients.updateClient(client.id, { notes: JSON.stringify(parsed) });
		}
		toast.success('Contacto registrado');
	}

	function getLeadScore(c: Client): number {
		let score = 0;
		if (c.email) score += 20;
		if (c.phone) score += 20;
		if (c.address) score += 10;
		if (c.agentId) score += 15;
		score += Math.min(contactHistory.length * 10, 35);
		return Math.min(score, 100);
	}

	function getScoreColor(score: number): string {
		if (score >= 70) return 'text-green-600';
		if (score >= 40) return 'text-yellow-600';
		return 'text-red-600';
	}

	onMount(loadClient);
</script>

<svelte:head>
	<title>{client?.fullName || 'Cliente'} | Inmobiliaria</title>
</svelte:head>

{#if loading}
	<div class="flex items-center justify-center p-12">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
	</div>
{:else if client}
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<button class="mb-2 text-sm text-muted-foreground hover:text-foreground" onclick={() => goto('/dashboard/clients')}>
					← Volver a clientes
				</button>
				<div class="flex items-center gap-3">
					<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
						{client.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
					</div>
					<div>
						<h1 class="text-2xl font-bold tracking-tight">{client.fullName}</h1>
						<p class="text-sm text-muted-foreground">
							Cliente desde {formatDate(client.createdAt)}
							{#if client.agentId}
								· <Badge variant="secondary">Agente #{client.agentId}</Badge>
							{/if}
						</p>
					</div>
				</div>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={() => (contactModalOpen = true)}>
					📞 Registrar Contacto
				</Button>
				{#if isEditing}
					<Button variant="outline" onclick={() => (isEditing = false)}>Cancelar</Button>
				{:else}
					<Button variant="outline" onclick={() => (isEditing = true)}>✏️ Editar</Button>
				{/if}
				<Button variant="destructive" onclick={() => (deleteModalOpen = true)}>🗑️</Button>
			</div>
		</div>

		<!-- Lead Score & Stats -->
		<div class="grid gap-4 sm:grid-cols-4">
			<Card>
				<div class="p-4 text-center">
					<p class="text-sm text-muted-foreground">Lead Score</p>
					<p class="text-3xl font-bold {getScoreColor(getLeadScore(client))}">{getLeadScore(client)}</p>
					<div class="mx-auto mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
						<div class="h-full rounded-full bg-primary transition-all" style="width: {getLeadScore(client)}%"></div>
					</div>
				</div>
			</Card>
			<Card>
				<div class="p-4 text-center">
					<p class="text-sm text-muted-foreground">Contactos</p>
					<p class="text-3xl font-bold">{contactHistory.length}</p>
				</div>
			</Card>
			<Card>
				<div class="p-4 text-center">
					<p class="text-sm text-muted-foreground">Propiedades Vistas</p>
					<p class="text-3xl font-bold">{viewedProperties.length}</p>
				</div>
			</Card>
			<Card>
				<div class="p-4 text-center">
					<p class="text-sm text-muted-foreground">Último Contacto</p>
					<p class="text-sm font-medium">
						{contactHistory.length > 0 ? formatDate(contactHistory[0].date) : '—'}
					</p>
				</div>
			</Card>
		</div>

		<!-- Tabs -->
		<div class="flex gap-1 border-b">
			{#each [
				{ key: 'details', label: '📋 Detalles' },
				{ key: 'properties', label: '🏠 Propiedades' },
				{ key: 'history', label: '📞 Historial' },
				{ key: 'notes', label: '📝 Notas' }
			] as tab}
				<button
					class="border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === tab.key
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = tab.key as typeof activeTab)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Details Tab -->
		{#if activeTab === 'details'}
			{#if isEditing}
				<ClientForm
					initialData={client}
					onsubmit={handleUpdate}
					oncancel={() => (isEditing = false)}
					{saving}
				/>
			{:else}
				<Card>
					<div class="grid gap-6 p-6 sm:grid-cols-2">
						<div>
							<h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Información de Contacto</h3>
							<dl class="space-y-3">
								<div>
									<dt class="text-xs text-muted-foreground">Nombre completo</dt>
									<dd class="font-medium">{client.fullName}</dd>
								</div>
								<div>
									<dt class="text-xs text-muted-foreground">Email</dt>
									<dd>{client.email || '—'}</dd>
								</div>
								<div>
									<dt class="text-xs text-muted-foreground">Teléfono</dt>
									<dd>{client.phone || '—'}</dd>
								</div>
								<div>
									<dt class="text-xs text-muted-foreground">Dirección</dt>
									<dd>{client.address || '—'}</dd>
								</div>
							</dl>
						</div>
						<div>
							<h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Asignación</h3>
							<dl class="space-y-3">
								<div>
									<dt class="text-xs text-muted-foreground">Agente asignado</dt>
									<dd>
										{#if client.agentId}
											<Badge variant="secondary">Agente #{client.agentId}</Badge>
										{:else}
											<Badge variant="outline">Sin asignar</Badge>
										{/if}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-muted-foreground">Fecha de alta</dt>
									<dd>{formatDateTime(client.createdAt)}</dd>
								</div>
								{#if client.updatedAt}
									<div>
										<dt class="text-xs text-muted-foreground">Última actualización</dt>
										<dd>{formatDateTime(client.updatedAt)}</dd>
									</div>
								{/if}
							</dl>
						</div>
					</div>
				</Card>
			{/if}
		{/if}

		<!-- Properties Tab -->
		{#if activeTab === 'properties'}
			<Card>
				<div class="p-6">
					{#if viewedProperties.length === 0}
						<div class="py-8 text-center">
							<p class="text-lg font-medium text-muted-foreground">Sin propiedades asociadas</p>
							<p class="mt-1 text-sm text-muted-foreground">Las propiedades visitadas por este cliente aparecerán aquí</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each viewedProperties as property}
								<div class="flex items-center justify-between rounded-lg border p-3">
									<div>
										<p class="font-medium">{property.title}</p>
										<p class="text-sm text-muted-foreground">{property.address}, {property.city}</p>
									</div>
									<div class="text-right">
										<p class="font-semibold">{formatCurrency(property.price)}</p>
										<Badge>{property.status}</Badge>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</Card>
		{/if}

		<!-- History Tab -->
		{#if activeTab === 'history'}
			<Card>
				<div class="p-6">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="font-semibold">Historial de Contactos</h3>
						<Button size="sm" onclick={() => (contactModalOpen = true)}>+ Nuevo</Button>
					</div>
					{#if contactHistory.length === 0}
						<div class="py-8 text-center">
							<p class="text-lg font-medium text-muted-foreground">Sin historial de contacto</p>
							<p class="mt-1 text-sm text-muted-foreground">Registra llamadas, emails y reuniones</p>
						</div>
					{:else}
						<div class="relative space-y-4 border-l-2 border-muted pl-6">
							{#each contactHistory as entry}
								{@const typeInfo = CONTACT_TYPES.find((t) => t.value === entry.type)}
								<div class="relative">
									<div class="absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted bg-background text-xs">
										{typeInfo?.icon || '📌'}
									</div>
									<div class="rounded-lg border p-3">
										<div class="flex items-center gap-2">
											<Badge variant="secondary">{typeInfo?.label || entry.type}</Badge>
											<span class="text-xs text-muted-foreground">{formatDateTime(entry.date)}</span>
										</div>
										<p class="mt-1 text-sm font-medium">{entry.summary}</p>
										{#if entry.details}
											<p class="mt-1 text-xs text-muted-foreground">{entry.details}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</Card>
		{/if}

		<!-- Notes Tab -->
		{#if activeTab === 'notes'}
			{@const notesData = parseNotesData(client.notes)}
			<Card>
				<div class="p-6">
					<h3 class="mb-3 font-semibold">Notas</h3>
					<p class="whitespace-pre-wrap text-sm text-muted-foreground">
						{notesData.text || 'Sin notas'}
					</p>
				</div>
			</Card>
		{/if}
	</div>

	<!-- Delete Modal -->
	<Modal bind:open={deleteModalOpen} title="Eliminar cliente" size="sm">
		<p class="mb-4 text-sm text-muted-foreground">
			¿Eliminar a <strong>{client.fullName}</strong>? Esta acción no se puede deshacer.
		</p>
		<div class="flex justify-end gap-2">
			<Button variant="outline" onclick={() => (deleteModalOpen = false)}>Cancelar</Button>
			<Button variant="destructive" onclick={handleDelete}>Eliminar</Button>
		</div>
	</Modal>

	<!-- Contact Entry Modal -->
	<Modal bind:open={contactModalOpen} title="Registrar Contacto" size="md">
		<div class="space-y-4">
			<div>
				<label for="contactType" class="mb-1 block text-sm font-medium">Tipo</label>
				<Select id="contactType" options={contactTypeOptions} bind:value={newContactType} />
			</div>
			<div>
				<label for="contactSummary" class="mb-1 block text-sm font-medium">Resumen</label>
				<Input id="contactSummary" placeholder="Breve resumen del contacto" bind:value={newContactSummary} />
			</div>
			<div>
				<label for="contactDetails" class="mb-1 block text-sm font-medium">Detalles (opcional)</label>
				<textarea
					id="contactDetails"
					bind:value={newContactDetails}
					placeholder="Detalles adicionales..."
					class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={() => (contactModalOpen = false)}>Cancelar</Button>
				<Button onclick={addContactEntry}>Guardar</Button>
			</div>
		</div>
	</Modal>
{/if}
