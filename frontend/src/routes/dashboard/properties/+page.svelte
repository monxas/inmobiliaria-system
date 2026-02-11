<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { properties } from '$stores/properties';
	import { toast } from '$stores/toast';
	import Button from '$ui/Button.svelte';
	import Pagination from '$ui/Pagination.svelte';
	import Modal from '$ui/Modal.svelte';
	import PropertyCard from '$lib/components/properties/PropertyCard.svelte';
	import PropertyTable from '$lib/components/properties/PropertyTable.svelte';
	import PropertyFilters from '$lib/components/properties/PropertyFilters.svelte';
	import { PROPERTY_STATUSES } from '$types';

	let deleteModal = $state(false);
	let deleteId = $state<number | null>(null);
	let bulkActionModal = $state(false);
	let bulkAction = $state<'delete' | 'status'>('delete');
	let bulkStatus = $state('');

	onMount(() => {
		properties.fetchAll();
	});

	function handleView(id: number) {
		goto(`/dashboard/properties/${id}`);
	}

	function handleEdit(id: number) {
		goto(`/dashboard/properties/${id}/edit`);
	}

	function handleDelete(id: number) {
		deleteId = id;
		deleteModal = true;
	}

	async function confirmDelete() {
		if (deleteId) {
			await properties.remove(deleteId);
			deleteModal = false;
			deleteId = null;
		}
	}

	async function confirmBulkAction() {
		let state: any;
		properties.subscribe((s) => (state = s))();
		const ids = Array.from(state.selectedIds) as number[];

		if (bulkAction === 'delete') {
			await properties.bulkDelete(ids);
		} else if (bulkAction === 'status' && bulkStatus) {
			await properties.bulkUpdateStatus(ids, bulkStatus);
		}
		bulkActionModal = false;
	}

	function openBulkDelete() {
		bulkAction = 'delete';
		bulkActionModal = true;
	}

	function openBulkStatus() {
		bulkAction = 'status';
		bulkActionModal = true;
	}
</script>

<svelte:head>
	<title>Propiedades | Inmobiliaria</title>
</svelte:head>

{#snippet content(state: any)}
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Propiedades</h1>
				<p class="text-sm text-muted-foreground">{state.total} propiedades en total</p>
			</div>
			<div class="flex gap-2">
				<Button onclick={() => goto('/dashboard/properties/new')}>
					<svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
					Nueva propiedad
				</Button>
			</div>
		</div>

		<!-- Filters -->
		<PropertyFilters filters={state.filters} onchange={(f) => properties.setFilters(f)} />

		<!-- Toolbar -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				{#if state.selectedIds.size > 0}
					<span class="text-sm text-muted-foreground">{state.selectedIds.size} seleccionadas</span>
					<Button variant="destructive" size="sm" onclick={openBulkDelete}>Eliminar</Button>
					<Button variant="outline" size="sm" onclick={openBulkStatus}>Cambiar estado</Button>
					<Button variant="ghost" size="sm" onclick={() => properties.clearSelection()}>Deseleccionar</Button>
				{/if}
			</div>
			<div class="flex gap-1">
				<Button
					variant={state.viewMode === 'grid' ? 'default' : 'ghost'}
					size="icon"
					onclick={() => { if (state.viewMode !== 'grid') properties.toggleView(); }}
					title="Vista cuadrícula"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
				</Button>
				<Button
					variant={state.viewMode === 'table' ? 'default' : 'ghost'}
					size="icon"
					onclick={() => { if (state.viewMode !== 'table') properties.toggleView(); }}
					title="Vista tabla"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
				</Button>
			</div>
		</div>

		<!-- Content -->
		{#if state.loading && state.items.length === 0}
			<div class="flex h-64 items-center justify-center">
				<div class="text-center">
					<svg class="mx-auto h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
					<p class="mt-2 text-sm text-muted-foreground">Cargando propiedades...</p>
				</div>
			</div>
		{:else if state.viewMode === 'grid'}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each state.items as property (property.id)}
					<PropertyCard
						{property}
						selected={state.selectedIds.has(property.id)}
						onselect={(id) => properties.toggleSelect(id)}
						onview={handleView}
						onedit={handleEdit}
						ondelete={handleDelete}
					/>
				{/each}
			</div>
		{:else}
			<PropertyTable
				items={state.items}
				selectedIds={state.selectedIds}
				onselect={(id) => properties.toggleSelect(id)}
				onselectall={() => {
					const allSelected = state.items.every((p: any) => state.selectedIds.has(p.id));
					if (allSelected) properties.clearSelection();
					else properties.selectAll();
				}}
				onview={handleView}
				onedit={handleEdit}
				ondelete={handleDelete}
			/>
		{/if}

		<!-- Empty state -->
		{#if !state.loading && state.items.length === 0}
			<div class="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
				</svg>
				<h3 class="mt-3 font-semibold">No hay propiedades</h3>
				<p class="mt-1 text-sm text-muted-foreground">Comienza creando tu primera propiedad</p>
				<Button class="mt-4" onclick={() => goto('/dashboard/properties/new')}>Crear propiedad</Button>
			</div>
		{/if}

		<!-- Pagination -->
		{#if state.totalPages > 1}
			<div class="flex justify-center">
				<Pagination page={state.page} totalPages={state.totalPages} onPageChange={(p) => properties.setPage(p)} />
			</div>
		{/if}
	</div>
{/snippet}

{#if $properties}
	{@render content($properties)}
{/if}

<!-- Delete confirmation -->
<Modal bind:open={deleteModal} title="Confirmar eliminación" size="sm">
	<p class="text-sm text-muted-foreground">¿Estás seguro de que deseas eliminar esta propiedad? Esta acción no se puede deshacer.</p>
	<div class="mt-4 flex justify-end gap-2">
		<Button variant="outline" onclick={() => (deleteModal = false)}>Cancelar</Button>
		<Button variant="destructive" onclick={confirmDelete}>Eliminar</Button>
	</div>
</Modal>

<!-- Bulk action modal -->
<Modal bind:open={bulkActionModal} title={bulkAction === 'delete' ? 'Eliminación masiva' : 'Cambiar estado masivo'} size="sm">
	{#if bulkAction === 'delete'}
		<p class="text-sm text-muted-foreground">¿Eliminar {$properties.selectedIds.size} propiedades seleccionadas?</p>
	{:else}
		<p class="mb-3 text-sm text-muted-foreground">Nuevo estado para {$properties.selectedIds.size} propiedades:</p>
		<select bind:value={bulkStatus} class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
			<option value="">Seleccionar estado...</option>
			{#each PROPERTY_STATUSES as s}
				<option value={s.value}>{s.label}</option>
			{/each}
		</select>
	{/if}
	<div class="mt-4 flex justify-end gap-2">
		<Button variant="outline" onclick={() => (bulkActionModal = false)}>Cancelar</Button>
		<Button variant={bulkAction === 'delete' ? 'destructive' : 'default'} onclick={confirmBulkAction} disabled={bulkAction === 'status' && !bulkStatus}>
			{bulkAction === 'delete' ? 'Eliminar' : 'Aplicar'}
		</Button>
	</div>
</Modal>
