<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { clients } from '$stores/clients';
	import type { Client, ClientInput, ClientInteraction, ClientPropertyMatch } from '$types';
	import Button from '$ui/Button.svelte';
	import Badge from '$ui/Badge.svelte';
	import Card from '$ui/Card.svelte';
	import Modal from '$ui/Modal.svelte';
	import Input from '$ui/Input.svelte';
	import Select from '$ui/Select.svelte';
	import ClientForm from '$lib/components/forms/ClientForm.svelte';
	import { formatDate, formatDateTime, formatCurrency } from '$lib/utils';
	import { toast } from '$stores/toast';
	import { clientsApi } from '$api/client';

	// ============================================
	// State
	// ============================================
	let client = $state<Client | null>(null);
	let loading = $state(true);
	let isEditing = $state(false);
	let saving = $state(false);
	let deleteModalOpen = $state(false);
	let contactModalOpen = $state(false);
	let activeTab = $state<'overview' | 'details' | 'preferences' | 'interactions' | 'matches'>('overview');

	// Interactions from API
	let interactions = $state<ClientInteraction[]>([]);
	let loadingInteractions = $state(false);

	// Property matches
	let propertyMatches = $state<ClientPropertyMatch[]>([]);
	let loadingMatches = $state(false);
	let matchingInProgress = $state(false);

	// New interaction form
	let newInteractionType = $state('call');
	let newInteractionSummary = $state('');
	let newInteractionDetails = $state('');
	let newInteractionOutcome = $state('');
	let newInteractionDuration = $state('');

	// ============================================
	// Constants
	// ============================================
	const INTERACTION_TYPES = [
		{ value: 'call', label: '📞 Llamada' },
		{ value: 'email', label: '📧 Email' },
		{ value: 'meeting', label: '🤝 Reunión' },
		{ value: 'whatsapp', label: '💬 WhatsApp' },
		{ value: 'visit', label: '🏠 Visita' },
		{ value: 'note', label: '📝 Nota' },
	];

	const OUTCOME_OPTIONS = [
		{ value: '', label: '— Sin resultado —' },
		{ value: 'positive', label: '✅ Positivo' },
		{ value: 'neutral', label: '😐 Neutral' },
		{ value: 'negative', label: '❌ Negativo' },
		{ value: 'no_answer', label: '📵 Sin respuesta' },
	];

	const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
		lead: { label: 'Lead', color: 'bg-blue-100 text-blue-800', icon: '🔵' },
		contacted: { label: 'Contactado', color: 'bg-yellow-100 text-yellow-800', icon: '📞' },
		qualified: { label: 'Cualificado', color: 'bg-orange-100 text-orange-800', icon: '✅' },
		negotiating: { label: 'Negociando', color: 'bg-purple-100 text-purple-800', icon: '🤝' },
		closed: { label: 'Cerrado', color: 'bg-green-100 text-green-800', icon: '🎉' },
		lost: { label: 'Perdido', color: 'bg-red-100 text-red-800', icon: '❌' },
	};

	const SOURCE_LABELS: Record<string, string> = {
		website: '🌐 Web', referral: '👥 Referido', walk_in: '🚶 Walk-in',
		phone: '📞 Teléfono', social_media: '📱 RRSS', portal: '🏠 Portal',
		advertising: '📣 Publicidad', other: '📌 Otro',
	};

	const CONTACT_METHOD_LABELS: Record<string, string> = {
		phone: '📞 Teléfono', email: '📧 Email', whatsapp: '💬 WhatsApp', in_person: '🤝 En persona',
	};

	const INTEREST_LABELS: Record<string, string> = {
		buy: '🏠 Comprar', rent: '🔑 Alquilar', both: '🏠🔑 Ambos',
	};

	// ============================================
	// Data Loading
	// ============================================
	async function loadClient() {
		const id = Number($page.params.id);
		if (isNaN(id)) { goto('/dashboard/clients'); return; }
		loading = true;
		client = await clients.fetchClient(id);
		loading = false;
		if (!client) { goto('/dashboard/clients'); return; }
		// Load interactions
		loadInteractions();
	}

	async function loadInteractions() {
		if (!client) return;
		loadingInteractions = true;
		try {
			const res = await clientsApi.getInteractions(client.id);
			if (res.success && res.data) interactions = res.data;
		} catch { /* ignore */ }
		loadingInteractions = false;
	}

	async function loadMatches() {
		if (!client) return;
		loadingMatches = true;
		try {
			const res = await clientsApi.getPropertyMatches(client.id);
			if (res.success && res.data) propertyMatches = res.data;
		} catch { /* ignore */ }
		loadingMatches = false;
	}

	// ============================================
	// Actions
	// ============================================
	async function handleUpdate(data: ClientInput) {
		if (!client) return;
		saving = true;
		const result = await clients.updateClient(client.id, data);
		saving = false;
		if (result) {
			client = result;
			isEditing = false;
		}
	}

	async function handleDelete() {
		if (!client) return;
		const success = await clients.deleteClient(client.id);
		if (success) goto('/dashboard/clients');
		deleteModalOpen = false;
	}

	async function addInteraction() {
		if (!client || !newInteractionSummary.trim()) {
			toast.warning('Escribe un resumen del contacto');
			return;
		}
		try {
			const res = await clientsApi.addInteraction(client.id, {
				interactionType: newInteractionType,
				summary: newInteractionSummary,
				details: newInteractionDetails || undefined,
				outcome: newInteractionOutcome || undefined,
				durationMinutes: newInteractionDuration ? Number(newInteractionDuration) : undefined,
			});
			if (res.success && res.data) {
				interactions = [res.data, ...interactions];
				// Refresh client for updated score
				client = await clients.fetchClient(client.id);
			}
			newInteractionSummary = '';
			newInteractionDetails = '';
			newInteractionOutcome = '';
			newInteractionDuration = '';
			contactModalOpen = false;
			toast.success('Interacción registrada');
		} catch (e) {
			toast.error('Error registrando interacción');
		}
	}

	async function runPropertyMatching() {
		if (!client) return;
		matchingInProgress = true;
		try {
			const res = await clientsApi.matchProperties(client.id);
			if (res.success && res.data) {
				propertyMatches = res.data;
				toast.success(`${res.data.length} propiedades encontradas`);
			}
		} catch {
			toast.error('Error en matching');
		}
		matchingInProgress = false;
	}

	// ============================================
	// Helpers
	// ============================================
	function getScoreColor(score: number): string {
		if (score >= 70) return 'text-green-600';
		if (score >= 40) return 'text-yellow-600';
		return 'text-red-600';
	}

	function getScoreBgColor(score: number): string {
		if (score >= 70) return 'bg-green-500';
		if (score >= 40) return 'bg-yellow-500';
		return 'bg-red-500';
	}

	function getMatchScoreColor(score: number): string {
		if (score >= 70) return 'text-green-600 bg-green-50';
		if (score >= 50) return 'text-yellow-600 bg-yellow-50';
		return 'text-red-600 bg-red-50';
	}

	function parseTags(tags: string | null | undefined): string[] {
		if (!tags) return [];
		try { return JSON.parse(tags); } catch { return tags.split(',').map(t => t.trim()).filter(Boolean); }
	}

	function parseZones(zones: string | null | undefined): string[] {
		if (!zones) return [];
		try { return JSON.parse(zones); } catch { return zones.split(',').map(z => z.trim()).filter(Boolean); }
	}

	function parsePropertyTypes(types: string | null | undefined): string[] {
		if (!types) return [];
		try { return JSON.parse(types); } catch { return types.split(',').map(t => t.trim()).filter(Boolean); }
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `hace ${mins}m`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `hace ${hours}h`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `hace ${days}d`;
		return formatDate(dateStr);
	}

	onMount(loadClient);

	// Load matches when tab changes
	$effect(() => {
		if (activeTab === 'matches' && propertyMatches.length === 0 && client) {
			loadMatches();
		}
	});
</script>

<svelte:head>
	<title>{client?.fullName || 'Cliente'} | CRM Inmobiliaria</title>
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
					<div class="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
						{client.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h1 class="text-2xl font-bold tracking-tight">{client.fullName}</h1>
							{#if client.status}
								{@const st = STATUS_CONFIG[client.status]}
								<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium {st?.color || ''}">
									{st?.icon} {st?.label}
								</span>
							{/if}
						</div>
						<p class="text-sm text-muted-foreground">
							{#if client.company}<span class="font-medium">{client.company}</span> · {/if}
							{#if client.occupation}{client.occupation} · {/if}
							Cliente desde {formatDate(client.createdAt)}
							{#if client.source}
								· <span class="text-xs">{SOURCE_LABELS[client.source] || client.source}</span>
							{/if}
						</p>
						{#if client.tags}
							<div class="mt-1 flex flex-wrap gap-1">
								{#each parseTags(client.tags) as tag}
									<span class="rounded-full bg-muted px-2 py-0.5 text-xs">{tag}</span>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button variant="outline" size="sm" onclick={() => (contactModalOpen = true)}>
					📞 Registrar Contacto
				</Button>
				{#if isEditing}
					<Button variant="outline" size="sm" onclick={() => (isEditing = false)}>Cancelar</Button>
				{:else}
					<Button variant="outline" size="sm" onclick={() => (isEditing = true)}>✏️ Editar</Button>
				{/if}
				<Button variant="destructive" size="sm" onclick={() => (deleteModalOpen = true)}>🗑️</Button>
			</div>
		</div>

		<!-- Stats Cards -->
		<div class="grid gap-3 sm:grid-cols-5">
			<Card>
				<div class="p-4 text-center">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lead Score</p>
					<p class="mt-1 text-3xl font-bold {getScoreColor(client.leadScore || 0)}">{client.leadScore || 0}</p>
					<div class="mx-auto mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div class="h-full rounded-full {getScoreBgColor(client.leadScore || 0)} transition-all" style="width: {client.leadScore || 0}%"></div>
					</div>
				</div>
			</Card>
			<Card>
				<div class="p-4 text-center">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Interacciones</p>
					<p class="mt-1 text-3xl font-bold">{client.totalContacts || 0}</p>
				</div>
			</Card>
			<Card>
				<div class="p-4 text-center">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Visitas</p>
					<p class="mt-1 text-3xl font-bold">{client.totalViewings || 0}</p>
				</div>
			</Card>
			<Card>
				<div class="p-4 text-center">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Último Contacto</p>
					<p class="mt-1 text-sm font-medium">
						{client.lastContactAt ? timeAgo(client.lastContactAt) : '—'}
					</p>
				</div>
			</Card>
			<Card>
				<div class="p-4 text-center">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Presupuesto</p>
					<p class="mt-1 text-sm font-medium">
						{#if client.budgetMin || client.budgetMax}
							{client.budgetMin ? formatCurrency(client.budgetMin) : '—'} - {client.budgetMax ? formatCurrency(client.budgetMax) : '—'}
						{:else}
							<span class="text-muted-foreground">Sin definir</span>
						{/if}
					</p>
				</div>
			</Card>
		</div>

		<!-- Tabs -->
		<div class="flex gap-1 overflow-x-auto border-b">
			{#each [
				{ key: 'overview', label: '📊 Resumen' },
				{ key: 'details', label: '👤 Datos Personales' },
				{ key: 'preferences', label: '🏠 Preferencias' },
				{ key: 'interactions', label: '📞 Historial' },
				{ key: 'matches', label: '🎯 Matching' },
			] as tab}
				<button
					class="whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === tab.key
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = tab.key as typeof activeTab)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- ============ OVERVIEW TAB ============ -->
		{#if activeTab === 'overview'}
			{#if isEditing}
				<ClientForm initialData={client} onsubmit={handleUpdate} oncancel={() => (isEditing = false)} {saving} />
			{:else}
				<div class="grid gap-4 lg:grid-cols-2">
					<!-- Contact Info -->
					<Card>
						<div class="p-5">
							<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								📋 Información de Contacto
							</h3>
							<dl class="space-y-2.5">
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Email</dt>
									<dd class="text-sm font-medium">{client.email || '—'}</dd>
								</div>
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Teléfono</dt>
									<dd class="text-sm font-medium">{client.phone || '—'}</dd>
								</div>
								{#if client.phoneSecondary}
									<div class="flex justify-between">
										<dt class="text-sm text-muted-foreground">Tel. secundario</dt>
										<dd class="text-sm font-medium">{client.phoneSecondary}</dd>
									</div>
								{/if}
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Dirección</dt>
									<dd class="text-sm font-medium text-right max-w-[60%]">{client.address || '—'}</dd>
								</div>
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Contacto preferido</dt>
									<dd class="text-sm font-medium">{CONTACT_METHOD_LABELS[client.preferredContact || 'phone']}</dd>
								</div>
								{#if client.preferredContactTime}
									<div class="flex justify-between">
										<dt class="text-sm text-muted-foreground">Horario preferido</dt>
										<dd class="text-sm font-medium">{client.preferredContactTime}</dd>
									</div>
								{/if}
							</dl>
						</div>
					</Card>

					<!-- Quick Preferences -->
					<Card>
						<div class="p-5">
							<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								🏠 Resumen Búsqueda
							</h3>
							<dl class="space-y-2.5">
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Interés</dt>
									<dd class="text-sm font-medium">{INTEREST_LABELS[client.interestType || 'buy']}</dd>
								</div>
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Presupuesto</dt>
									<dd class="text-sm font-medium">
										{#if client.budgetMin || client.budgetMax}
											{client.budgetMin ? formatCurrency(client.budgetMin) : '?'} - {client.budgetMax ? formatCurrency(client.budgetMax) : '?'}
										{:else}
											—
										{/if}
									</dd>
								</div>
								{#if client.minBedrooms}
									<div class="flex justify-between">
										<dt class="text-sm text-muted-foreground">Mín. habitaciones</dt>
										<dd class="text-sm font-medium">{client.minBedrooms}</dd>
									</div>
								{/if}
								{#if client.minSurface}
									<div class="flex justify-between">
										<dt class="text-sm text-muted-foreground">Mín. superficie</dt>
										<dd class="text-sm font-medium">{client.minSurface} m²</dd>
									</div>
								{/if}
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Garaje / Jardín</dt>
									<dd class="text-sm font-medium">
										{client.needsGarage ? '🅿️ Sí' : '—'} / {client.needsGarden ? '🌿 Sí' : '—'}
									</dd>
								</div>
								{#if client.preferredZones}
									<div>
										<dt class="text-sm text-muted-foreground mb-1">Zonas preferidas</dt>
										<dd class="flex flex-wrap gap-1">
											{#each parseZones(client.preferredZones) as zone}
												<span class="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{zone}</span>
											{/each}
										</dd>
									</div>
								{/if}
							</dl>
						</div>
					</Card>

					<!-- Recent Activity -->
					<Card>
						<div class="p-5">
							<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								⏱️ Actividad Reciente
							</h3>
							{#if interactions.length === 0}
								<p class="text-sm text-muted-foreground">Sin interacciones registradas</p>
							{:else}
								<div class="space-y-2">
									{#each interactions.slice(0, 5) as interaction}
										{@const typeInfo = INTERACTION_TYPES.find(t => t.value === interaction.interactionType)}
										<div class="flex items-start gap-2 rounded-lg border p-2">
											<span class="text-sm">{typeInfo?.label.split(' ')[0] || '📌'}</span>
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">{interaction.summary}</p>
												<p class="text-xs text-muted-foreground">{timeAgo(interaction.createdAt)}</p>
											</div>
											{#if interaction.outcome}
												<span class="text-xs">{interaction.outcome === 'positive' ? '✅' : interaction.outcome === 'negative' ? '❌' : '😐'}</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</Card>

					<!-- Notes -->
					<Card>
						<div class="p-5">
							<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								📝 Notas
							</h3>
							<p class="whitespace-pre-wrap text-sm text-muted-foreground">
								{client.notes || 'Sin notas'}
							</p>
							{#if client.nextFollowupAt}
								<div class="mt-3 rounded-lg bg-amber-50 p-2">
									<p class="text-xs font-medium text-amber-800">
										⏰ Próximo seguimiento: {formatDateTime(client.nextFollowupAt)}
									</p>
								</div>
							{/if}
						</div>
					</Card>
				</div>
			{/if}
		{/if}

		<!-- ============ DETAILS TAB ============ -->
		{#if activeTab === 'details'}
			{#if isEditing}
				<ClientForm initialData={client} onsubmit={handleUpdate} oncancel={() => (isEditing = false)} {saving} />
			{:else}
				<div class="grid gap-4 lg:grid-cols-2">
					<Card>
						<div class="p-5">
							<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Datos Personales</h3>
							<dl class="space-y-3">
								{#each [
									['Nombre completo', client.fullName],
									['DNI/NIE', client.dni],
									['Fecha nacimiento', client.dateOfBirth ? formatDate(client.dateOfBirth) : null],
									['Nacionalidad', client.nationality],
									['Ocupación', client.occupation],
									['Empresa', client.company],
									['Idioma', client.language?.toUpperCase()],
									['Zona horaria', client.timezone],
								] as [string, string | null | undefined]}
									<div class="flex justify-between border-b border-dashed pb-2 last:border-0">
										<dt class="text-sm text-muted-foreground">{@html arguments[0]}</dt>
										<dd class="text-sm font-medium">{arguments[1] || '—'}</dd>
									</div>
								{/each}
							</dl>
						</div>
					</Card>
					<Card>
						<div class="p-5">
							<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contacto & Asignación</h3>
							<dl class="space-y-3">
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Email</dt>
									<dd class="text-sm font-medium">{client.email || '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Teléfono principal</dt>
									<dd class="text-sm font-medium">{client.phone || '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Teléfono secundario</dt>
									<dd class="text-sm font-medium">{client.phoneSecondary || '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Dirección</dt>
									<dd class="text-sm font-medium text-right max-w-[60%]">{client.address || '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Método contacto preferido</dt>
									<dd class="text-sm font-medium">{CONTACT_METHOD_LABELS[client.preferredContact || ''] || '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Horario preferido</dt>
									<dd class="text-sm font-medium">{client.preferredContactTime || '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Fuente</dt>
									<dd class="text-sm font-medium">{SOURCE_LABELS[client.source || ''] || '—'}</dd>
								</div>
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Agente asignado</dt>
									<dd>
										{#if client.agentId}
											<Badge variant="secondary">Agente #{client.agentId}</Badge>
										{:else}
											<Badge variant="outline">Sin asignar</Badge>
										{/if}
									</dd>
								</div>
							</dl>
						</div>
					</Card>
				</div>
			{/if}
		{/if}

		<!-- ============ PREFERENCES TAB ============ -->
		{#if activeTab === 'preferences'}
			{#if isEditing}
				<ClientForm initialData={client} onsubmit={handleUpdate} oncancel={() => (isEditing = false)} {saving} />
			{:else}
				<div class="grid gap-4 lg:grid-cols-2">
					<Card>
						<div class="p-5">
							<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Preferencias de Propiedad</h3>
							<dl class="space-y-3">
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Tipo de interés</dt>
									<dd class="text-sm font-medium">{INTEREST_LABELS[client.interestType || 'buy']}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Presupuesto mínimo</dt>
									<dd class="text-sm font-medium">{client.budgetMin ? formatCurrency(client.budgetMin) : '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Presupuesto máximo</dt>
									<dd class="text-sm font-medium">{client.budgetMax ? formatCurrency(client.budgetMax) : '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Mín. habitaciones</dt>
									<dd class="text-sm font-medium">{client.minBedrooms ?? '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Mín. baños</dt>
									<dd class="text-sm font-medium">{client.minBathrooms ?? '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Mín. superficie</dt>
									<dd class="text-sm font-medium">{client.minSurface ? `${client.minSurface} m²` : '—'}</dd>
								</div>
								<div class="flex justify-between border-b border-dashed pb-2">
									<dt class="text-sm text-muted-foreground">Necesita garaje</dt>
									<dd class="text-sm font-medium">{client.needsGarage ? '✅ Sí' : '❌ No'}</dd>
								</div>
								<div class="flex justify-between">
									<dt class="text-sm text-muted-foreground">Necesita jardín</dt>
									<dd class="text-sm font-medium">{client.needsGarden ? '✅ Sí' : '❌ No'}</dd>
								</div>
							</dl>
						</div>
					</Card>
					<Card>
						<div class="p-5">
							<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Zonas y Tipos</h3>
							
							<div class="mb-4">
								<p class="mb-2 text-sm text-muted-foreground">Zonas preferidas</p>
								{#if client.preferredZones}
									<div class="flex flex-wrap gap-1.5">
										{#each parseZones(client.preferredZones) as zone}
											<span class="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">{zone}</span>
										{/each}
									</div>
								{:else}
									<p class="text-sm text-muted-foreground">No especificadas</p>
								{/if}
							</div>

							<div class="mb-4">
								<p class="mb-2 text-sm text-muted-foreground">Tipos de propiedad</p>
								{#if client.preferredPropertyTypes}
									<div class="flex flex-wrap gap-1.5">
										{#each parsePropertyTypes(client.preferredPropertyTypes) as type}
											<span class="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">{type}</span>
										{/each}
									</div>
								{:else}
									<p class="text-sm text-muted-foreground">No especificados</p>
								{/if}
							</div>

							{#if client.additionalRequirements}
								<div>
									<p class="mb-2 text-sm text-muted-foreground">Requisitos adicionales</p>
									<p class="text-sm whitespace-pre-wrap">{client.additionalRequirements}</p>
								</div>
							{/if}
						</div>
					</Card>
				</div>
			{/if}
		{/if}

		<!-- ============ INTERACTIONS TAB ============ -->
		{#if activeTab === 'interactions'}
			<Card>
				<div class="p-5">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="font-semibold">Historial de Interacciones</h3>
						<Button size="sm" onclick={() => (contactModalOpen = true)}>+ Nueva Interacción</Button>
					</div>
					{#if loadingInteractions}
						<div class="flex justify-center py-8">
							<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
						</div>
					{:else if interactions.length === 0}
						<div class="py-8 text-center">
							<p class="text-lg font-medium text-muted-foreground">Sin historial</p>
							<p class="mt-1 text-sm text-muted-foreground">Registra llamadas, emails, reuniones y más</p>
						</div>
					{:else}
						<div class="relative space-y-3 border-l-2 border-muted pl-6">
							{#each interactions as interaction}
								{@const typeInfo = INTERACTION_TYPES.find(t => t.value === interaction.interactionType)}
								<div class="relative">
									<div class="absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted bg-background text-xs">
										{typeInfo?.label.split(' ')[0] || '📌'}
									</div>
									<div class="rounded-lg border p-3">
										<div class="flex flex-wrap items-center gap-2">
											<Badge variant="secondary">{typeInfo?.label.split(' ').slice(1).join(' ') || interaction.interactionType}</Badge>
											{#if interaction.outcome}
												<Badge variant="outline">
													{interaction.outcome === 'positive' ? '✅ Positivo' : interaction.outcome === 'negative' ? '❌ Negativo' : interaction.outcome === 'no_answer' ? '📵 Sin respuesta' : '😐 Neutral'}
												</Badge>
											{/if}
											{#if interaction.durationMinutes}
												<span class="text-xs text-muted-foreground">⏱ {interaction.durationMinutes} min</span>
											{/if}
											<span class="ml-auto text-xs text-muted-foreground">{formatDateTime(interaction.createdAt)}</span>
										</div>
										<p class="mt-1.5 text-sm font-medium">{interaction.summary}</p>
										{#if interaction.details}
											<p class="mt-1 text-xs text-muted-foreground">{interaction.details}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</Card>
		{/if}

		<!-- ============ MATCHES TAB ============ -->
		{#if activeTab === 'matches'}
			<Card>
				<div class="p-5">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="font-semibold">Propiedades Sugeridas</h3>
						<Button size="sm" onclick={runPropertyMatching} loading={matchingInProgress}>
							🎯 {matchingInProgress ? 'Buscando...' : 'Buscar Coincidencias'}
						</Button>
					</div>
					
					{#if !(client.budgetMin || client.budgetMax || client.minBedrooms || client.preferredZones)}
						<div class="mb-4 rounded-lg bg-amber-50 p-3">
							<p class="text-sm text-amber-800">
								⚠️ Completa las <button class="underline font-medium" onclick={() => { activeTab = 'preferences'; isEditing = true; }}>preferencias de búsqueda</button> 
								del cliente para obtener mejores resultados de matching.
							</p>
						</div>
					{/if}

					{#if loadingMatches}
						<div class="flex justify-center py-8">
							<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
						</div>
					{:else if propertyMatches.length === 0}
						<div class="py-8 text-center">
							<p class="text-lg font-medium text-muted-foreground">Sin coincidencias</p>
							<p class="mt-1 text-sm text-muted-foreground">Pulsa "Buscar Coincidencias" para encontrar propiedades</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each propertyMatches as match}
								<div class="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
									<div class="flex items-center gap-3">
										<div class="flex h-10 w-10 items-center justify-center rounded-lg {getMatchScoreColor(match.matchScore)} text-sm font-bold">
											{match.matchScore}%
										</div>
										<div>
											<p class="text-sm font-medium">Propiedad #{match.propertyId}</p>
											{#if match.matchReasons}
												{@const reasons = (() => { try { return JSON.parse(match.matchReasons); } catch { return []; } })()}
												<p class="text-xs text-muted-foreground">{reasons.join(', ')}</p>
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-2">
										<Badge variant="outline">{match.status}</Badge>
										<Button variant="outline" size="sm" onclick={() => goto(`/dashboard/properties/${match.propertyId}`)}>
											Ver →
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
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

	<!-- Interaction Modal -->
	<Modal bind:open={contactModalOpen} title="Registrar Interacción" size="md">
		<div class="space-y-4">
			<div>
				<label for="interactionType" class="mb-1 block text-sm font-medium">Tipo</label>
				<Select id="interactionType" options={INTERACTION_TYPES} bind:value={newInteractionType} />
			</div>
			<div>
				<label for="interactionSummary" class="mb-1 block text-sm font-medium">Resumen *</label>
				<Input id="interactionSummary" placeholder="Breve resumen de la interacción" bind:value={newInteractionSummary} />
			</div>
			<div>
				<label for="interactionOutcome" class="mb-1 block text-sm font-medium">Resultado</label>
				<Select id="interactionOutcome" options={OUTCOME_OPTIONS} bind:value={newInteractionOutcome} />
			</div>
			<div>
				<label for="interactionDuration" class="mb-1 block text-sm font-medium">Duración (minutos)</label>
				<Input id="interactionDuration" type="number" placeholder="15" bind:value={newInteractionDuration} />
			</div>
			<div>
				<label for="interactionDetails" class="mb-1 block text-sm font-medium">Detalles (opcional)</label>
				<textarea
					id="interactionDetails"
					bind:value={newInteractionDetails}
					placeholder="Detalles adicionales..."
					class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={() => (contactModalOpen = false)}>Cancelar</Button>
				<Button onclick={addInteraction}>💾 Guardar</Button>
			</div>
		</div>
	</Modal>
{/if}
