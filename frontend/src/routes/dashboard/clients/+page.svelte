<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { clients, CLIENT_STATUSES } from '$stores/clients';
	import type { ClientFilters } from '$types';
	import Button from '$ui/Button.svelte';
	import Input from '$ui/Input.svelte';
	import Select from '$ui/Select.svelte';
	import Badge from '$ui/Badge.svelte';
	import Card from '$ui/Card.svelte';
	import Pagination from '$ui/Pagination.svelte';
	import Modal from '$ui/Modal.svelte';
	import { formatDate, debounce } from '$lib/utils';
	import { toast } from '$stores/toast';

	let search = $state('');
	let statusFilter = $state('');
	let viewMode = $state<'table' | 'pipeline'>('table');
	let deleteModalOpen = $state(false);
	let clientToDelete = $state<number | null>(null);
	let selectedIds = $state<Set<number>>(new Set());

	const statusOptions = [
		{ value: '', label: 'Todos los estados' },
		...CLIENT_STATUSES.map((s) => ({ value: s.value, label: s.label }))
	];

	function getFilters(): ClientFilters {
		const filters: ClientFilters = {};
		if (search) filters.search = search;
		return filters;
	}

	const debouncedSearch = debounce(() => {
		clients.fetchClients(1, 10, getFilters());
	}, 300);

	function handleSearch() {
		debouncedSearch();
	}

	function handlePageChange(page: number) {
		clients.fetchClients(page, 10, getFilters());
	}

	function handleNewClient() {
		goto('/dashboard/clients/new');
	}

	function handleViewClient(id: number) {
		goto(`/dashboard/clients/${id}`);
	}

	function confirmDelete(id: number) {
		clientToDelete = id;
		deleteModalOpen = true;
	}

	async function handleDelete() {
		if (clientToDelete) {
			await clients.deleteClient(clientToDelete);
			deleteModalOpen = false;
			clientToDelete = null;
			clients.fetchClients($clients.pagination.page, 10, getFilters());
		}
	}

	function toggleSelect(id: number) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) newSet.delete(id);
		else newSet.add(id);
		selectedIds = newSet;
	}

	function toggleSelectAll() {
		if (selectedIds.size === $clients.clients.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set($clients.clients.map((c) => c.id));
		}
	}

	function exportCSV() {
		const data = $clients.clients.filter((c) => selectedIds.size === 0 || selectedIds.has(c.id));
		const headers = ['Nombre', 'Email', 'Teléfono', 'Dirección', 'Agente', 'Creado'];
		const rows = data.map((c) => [
			c.fullName,
			c.email || '',
			c.phone || '',
			c.address || '',
			c.agentId ? `Agente #${c.agentId}` : '',
			formatDate(c.createdAt)
		]);
		const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success(`${data.length} clientes exportados`);
	}

	onMount(() => {
		clients.fetchClients(1, 10);
	});
</script>

<svelte:head>
	<title>Clientes | Inmobiliaria</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Clientes</h1>
			<p class="text-muted-foreground">Gestiona tu cartera de clientes y leads</p>
		</div>
		<div class="flex gap-2">
			{#if selectedIds.size > 0}
				<Button variant="outline" size="sm" onclick={exportCSV}>
					📥 Exportar ({selectedIds.size})
				</Button>
			{:else}
				<Button variant="outline" size="sm" onclick={exportCSV}>
					📥 Exportar CSV
				</Button>
			{/if}
			<Button onclick={handleNewClient}>
				+ Nuevo Cliente
			</Button>
		</div>
	</div>

	<!-- Filters -->
	<Card>
		<div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
			<div class="flex-1">
				<label for="search" class="mb-1 block text-sm font-medium">Buscar</label>
				<Input
					id="search"
					placeholder="Nombre, email, teléfono..."
					bind:value={search}
					oninput={handleSearch}
				/>
			</div>
			<div class="w-full sm:w-48">
				<label for="status" class="mb-1 block text-sm font-medium">Estado</label>
				<Select id="status" options={statusOptions} bind:value={statusFilter} onchange={handleSearch} />
			</div>
			<div class="flex gap-2">
				<Button
					variant={viewMode === 'table' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (viewMode = 'table')}
				>
					📋
				</Button>
				<Button
					variant={viewMode === 'pipeline' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (viewMode = 'pipeline')}
				>
					🔀
				</Button>
			</div>
		</div>
	</Card>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		<Card>
			<div class="p-4 text-center">
				<p class="text-2xl font-bold">{$clients.pagination.total}</p>
				<p class="text-sm text-muted-foreground">Total Clientes</p>
			</div>
		</Card>
		<Card>
			<div class="p-4 text-center">
				<p class="text-2xl font-bold text-blue-600">{$clients.clients.length}</p>
				<p class="text-sm text-muted-foreground">En esta página</p>
			</div>
		</Card>
		<Card>
			<div class="p-4 text-center">
				<p class="text-2xl font-bold text-green-600">{$clients.clients.filter((c) => c.agentId).length}</p>
				<p class="text-sm text-muted-foreground">Con Agente</p>
			</div>
		</Card>
		<Card>
			<div class="p-4 text-center">
				<p class="text-2xl font-bold text-orange-600">{$clients.clients.filter((c) => !c.agentId).length}</p>
				<p class="text-sm text-muted-foreground">Sin Asignar</p>
			</div>
		</Card>
	</div>

	<!-- Table View -->
	{#if viewMode === 'table'}
		<Card>
			{#if $clients.isLoading}
				<div class="flex items-center justify-center p-12">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
				</div>
			{:else if $clients.clients.length === 0}
				<div class="p-12 text-center">
					<p class="text-lg font-medium text-muted-foreground">No hay clientes</p>
					<p class="mt-1 text-sm text-muted-foreground">Crea tu primer cliente para empezar</p>
					<Button class="mt-4" onclick={handleNewClient}>+ Nuevo Cliente</Button>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/50">
								<th class="p-3 text-left">
									<input
										type="checkbox"
										checked={selectedIds.size === $clients.clients.length && $clients.clients.length > 0}
										onchange={toggleSelectAll}
										class="rounded"
									/>
								</th>
								<th class="p-3 text-left font-medium">Cliente</th>
								<th class="hidden p-3 text-left font-medium sm:table-cell">Contacto</th>
								<th class="hidden p-3 text-center font-medium md:table-cell">Score</th>
								<th class="hidden p-3 text-left font-medium md:table-cell">Estado</th>
								<th class="hidden p-3 text-left font-medium lg:table-cell">Creado</th>
								<th class="p-3 text-right font-medium">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{#each $clients.clients as client (client.id)}
								<tr
									class="border-b transition-colors hover:bg-muted/50 cursor-pointer"
									onclick={() => handleViewClient(client.id)}
									role="row"
								>
									<td class="p-3">
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span onclick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedIds.has(client.id)}
												onchange={() => toggleSelect(client.id)}
												class="rounded"
											/>
										</span>
									</td>
									<td class="p-3">
										<div class="flex items-center gap-3">
											<div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
												{client.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
											</div>
											<div>
												<p class="font-medium">{client.fullName}</p>
												<p class="text-xs text-muted-foreground sm:hidden">{client.email || client.phone || '—'}</p>
											</div>
										</div>
									</td>
									<td class="hidden p-3 sm:table-cell">
										<div class="space-y-0.5">
											{#if client.email}
												<p class="text-sm">{client.email}</p>
											{/if}
											{#if client.phone}
												<p class="text-xs text-muted-foreground">{client.phone}</p>
											{/if}
											{#if !client.email && !client.phone}
												<p class="text-sm text-muted-foreground">—</p>
											{/if}
										</div>
									</td>
									<td class="hidden p-3 text-center md:table-cell">
										{@const score = client.leadScore || 0}
										<span class="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold {score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}">
											{score}
										</span>
									</td>
									<td class="hidden p-3 md:table-cell">
										{@const st = client.status || 'lead'}
										{@const stConfig = { lead: '🔵', contacted: '📞', qualified: '✅', negotiating: '🤝', closed: '🎉', lost: '❌' }}
										<Badge variant="secondary">{stConfig[st] || '🔵'} {st}</Badge>
									</td>
									<td class="hidden p-3 lg:table-cell">
										<span class="text-sm text-muted-foreground">{formatDate(client.createdAt)}</span>
									</td>
									<td class="p-3 text-right">
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span onclick={(e) => e.stopPropagation()}>
											<div class="flex justify-end gap-1">
												<Button variant="ghost" size="sm" onclick={() => handleViewClient(client.id)}>
													✏️
												</Button>
												<Button variant="ghost" size="sm" onclick={() => confirmDelete(client.id)}>
													🗑️
												</Button>
											</div>
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if $clients.pagination.totalPages > 1}
					<div class="flex justify-center border-t p-4">
						<Pagination
							page={$clients.pagination.page}
							totalPages={$clients.pagination.totalPages}
							onPageChange={handlePageChange}
						/>
					</div>
				{/if}
			{/if}
		</Card>
	{/if}

	<!-- Pipeline View -->
	{#if viewMode === 'pipeline'}
		<div class="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
			{#each CLIENT_STATUSES as status}
				<Card>
					<div class="p-3">
						<div class="mb-3 flex items-center gap-2">
							<span>{status.icon}</span>
							<h3 class="text-sm font-semibold">{status.label}</h3>
						</div>
						<div class="space-y-2">
							{#each $clients.clients.slice(0, 2) as client}
								<button
									class="w-full rounded-md border p-2 text-left text-xs transition-colors hover:bg-muted/50"
									onclick={() => handleViewClient(client.id)}
								>
									<p class="font-medium">{client.fullName}</p>
									{#if client.email}
										<p class="text-muted-foreground">{client.email}</p>
									{/if}
								</button>
							{/each}
							{#if $clients.clients.length === 0}
								<p class="py-4 text-center text-xs text-muted-foreground">Sin clientes</p>
							{/if}
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
<Modal bind:open={deleteModalOpen} title="Eliminar cliente" size="sm">
	<p class="mb-4 text-sm text-muted-foreground">
		¿Estás seguro de que quieres eliminar este cliente? Esta acción no se puede deshacer.
	</p>
	<div class="flex justify-end gap-2">
		<Button variant="outline" onclick={() => (deleteModalOpen = false)}>Cancelar</Button>
		<Button variant="destructive" onclick={handleDelete}>Eliminar</Button>
	</div>
</Modal>
