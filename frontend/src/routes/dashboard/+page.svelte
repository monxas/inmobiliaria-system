<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { user, isAdmin, isAgent } from '$stores/auth';
	import { dashboard } from '$stores/dashboard';
	import { formatCurrency, formatDateTime } from '$lib/utils';
	import KpiCard from '$lib/components/dashboard/KpiCard.svelte';
	import StatusChart from '$lib/components/dashboard/StatusChart.svelte';
	import ActivityFeed from '$lib/components/dashboard/ActivityFeed.svelte';
	import QuickActions from '$lib/components/dashboard/QuickActions.svelte';

	let refreshing = $state(false);

	const greeting = $derived(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Buenos días';
		if (hour < 19) return 'Buenas tardes';
		return 'Buenas noches';
	});

	async function refresh() {
		refreshing = true;
		await dashboard.load();
		refreshing = false;
	}

	onMount(() => {
		dashboard.load();
		dashboard.startAutoRefresh();
	});

	onDestroy(() => {
		dashboard.stopAutoRefresh();
	});
</script>

<svelte:head>
	<title>Dashboard | Inmobiliaria</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">
				{greeting()}, {$user?.fullName?.split(' ')[0] ?? 'Usuario'}
			</h1>
			<p class="text-muted-foreground text-sm mt-1">
				{#if $dashboard.lastUpdated}
					Actualizado: {formatDateTime($dashboard.lastUpdated)}
				{:else}
					Cargando datos...
				{/if}
			</p>
		</div>
		<button
			onclick={refresh}
			disabled={refreshing || $dashboard.isLoading}
			class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border bg-card hover:bg-accent transition-colors disabled:opacity-50 self-start"
		>
			<svg class="h-4 w-4 {refreshing || $dashboard.isLoading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
			Actualizar
		</button>
	</div>

	<!-- Error State -->
	{#if $dashboard.error}
		<div class="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
			<svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
			</svg>
			<div>
				<p class="text-sm font-medium">Error cargando datos</p>
				<p class="text-xs mt-0.5">{$dashboard.error}</p>
			</div>
			<button onclick={refresh} class="ml-auto text-xs underline hover:no-underline">Reintentar</button>
		</div>
	{/if}

	<!-- Loading Skeleton -->
	{#if $dashboard.isLoading && !$dashboard.stats}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{#each Array(4) as _}
				<div class="rounded-lg border bg-card p-6 animate-pulse">
					<div class="flex items-center justify-between">
						<div class="h-4 w-24 bg-muted rounded"></div>
						<div class="h-8 w-8 bg-muted rounded-lg"></div>
					</div>
					<div class="mt-3 h-8 w-16 bg-muted rounded"></div>
					<div class="mt-2 h-3 w-32 bg-muted rounded"></div>
				</div>
			{/each}
		</div>
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<div class="lg:col-span-2 rounded-lg border bg-card p-6 animate-pulse h-64"></div>
			<div class="rounded-lg border bg-card p-6 animate-pulse h-64"></div>
		</div>
	{:else if $dashboard.stats}
		<!-- KPI Cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<KpiCard
				title="Propiedades"
				value={$dashboard.stats.properties.total}
				subtitle="{$dashboard.stats.properties.available} disponibles"
				color="blue"
				icon="building"
			/>
			<KpiCard
				title="Clientes"
				value={$dashboard.stats.clients.total}
				subtitle="Clientes activos"
				color="emerald"
				icon="users"
			/>
			<KpiCard
				title="Documentos"
				value={$dashboard.stats.documents.total}
				subtitle="Archivos subidos"
				color="violet"
				icon="file"
			/>
			<KpiCard
				title="Ingresos"
				value={formatCurrency($dashboard.stats.revenue.total)}
				subtitle="{formatCurrency($dashboard.stats.revenue.monthly)} este mes"
				color="amber"
				icon="dollar"
				isText
			/>
		</div>

		<!-- Chart + Quick Actions -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<div class="lg:col-span-2">
				<StatusChart stats={$dashboard.stats.properties} />
			</div>
			<div>
				<QuickActions role={$user?.role ?? 'client'} />
			</div>
		</div>

		<!-- Activity Feeds -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<ActivityFeed
				title="Propiedades recientes"
				items={$dashboard.recentProperties.map(p => ({
					id: p.id,
					title: p.title,
					subtitle: `${p.city} · ${formatCurrency(p.price)}`,
					status: p.status,
					date: p.createdAt,
					href: `/dashboard/properties`
				}))}
				emptyText="No hay propiedades"
				viewAllHref="/dashboard/properties"
			/>
			<ActivityFeed
				title="Clientes recientes"
				items={$dashboard.recentClients.map(c => ({
					id: c.id,
					title: c.fullName,
					subtitle: c.email || c.phone || 'Sin contacto',
					date: c.createdAt,
					href: `/dashboard/clients`
				}))}
				emptyText="No hay clientes"
				viewAllHref="/dashboard/clients"
			/>
			<ActivityFeed
				title="Documentos recientes"
				items={$dashboard.recentDocuments.map(d => ({
					id: d.id,
					title: d.originalFilename,
					subtitle: d.category.replace(/_/g, ' '),
					date: d.createdAt,
					href: `/dashboard/documents`
				}))}
				emptyText="No hay documentos"
				viewAllHref="/dashboard/documents"
			/>
		</div>
	{/if}
</div>
