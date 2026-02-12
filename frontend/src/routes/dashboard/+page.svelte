<script lang="ts">
	import { user, isAuthenticated } from '$stores/auth-simple';
	import { FolderOpen, Users, FileText, BarChart3, TrendingUp, TrendingDown } from 'lucide-svelte';
	import { onMount } from 'svelte';

	// Dynamic stats - will be loaded from API later
	let stats = $state({
		properties: { value: 0, trend: 0 },
		clients: { value: 0, trend: 0 }, 
		sales: { value: 0, trend: 0 }
	});

	onMount(async () => {
		// TODO: Replace with real API calls
		// Simulate loading from backend
		setTimeout(() => {
			stats = {
				properties: { value: 24, trend: 3 },
				clients: { value: 187, trend: 12 },
				sales: { value: 1.2, trend: -0.1 }
			};
		}, 500);
	});
</script>

<svelte:head>
	<title>Dashboard | Inmobiliaria</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-foreground">Dashboard Inmobiliario</h1>
		<p class="text-muted-foreground">Bienvenido, {$user?.fullName ?? 'Usuario'}</p>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<div class="rounded-lg border bg-card p-6 shadow-sm">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-medium text-muted-foreground">Propiedades Activas</h3>
				{#if stats.properties.trend > 0}
					<TrendingUp class="h-4 w-4 text-green-600" />
				{:else if stats.properties.trend < 0}
					<TrendingDown class="h-4 w-4 text-red-600" />
				{/if}
			</div>
			<div class="mt-2 flex items-end gap-2">
				<p class="text-3xl font-bold text-primary">{stats.properties.value}</p>
				{#if stats.properties.trend !== 0}
					<span class="text-sm {stats.properties.trend > 0 ? 'text-green-600' : 'text-red-600'}">
						{stats.properties.trend > 0 ? '+' : ''}{stats.properties.trend}
					</span>
				{/if}
			</div>
		</div>
		<div class="rounded-lg border bg-card p-6 shadow-sm">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-medium text-muted-foreground">Clientes Activos</h3>
				{#if stats.clients.trend > 0}
					<TrendingUp class="h-4 w-4 text-green-600" />
				{:else if stats.clients.trend < 0}
					<TrendingDown class="h-4 w-4 text-red-600" />
				{/if}
			</div>
			<div class="mt-2 flex items-end gap-2">
				<p class="text-3xl font-bold text-green-600">{stats.clients.value}</p>
				{#if stats.clients.trend !== 0}
					<span class="text-sm {stats.clients.trend > 0 ? 'text-green-600' : 'text-red-600'}">
						{stats.clients.trend > 0 ? '+' : ''}{stats.clients.trend}
					</span>
				{/if}
			</div>
		</div>
		<div class="rounded-lg border bg-card p-6 shadow-sm">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-medium text-muted-foreground">Ventas Este Mes</h3>
				{#if stats.sales.trend > 0}
					<TrendingUp class="h-4 w-4 text-green-600" />
				{:else if stats.sales.trend < 0}
					<TrendingDown class="h-4 w-4 text-red-600" />
				{/if}
			</div>
			<div class="mt-2 flex items-end gap-2">
				<p class="text-3xl font-bold text-yellow-600">€{stats.sales.value}M</p>
				{#if stats.sales.trend !== 0}
					<span class="text-sm {stats.sales.trend > 0 ? 'text-green-600' : 'text-red-600'}">
						{stats.sales.trend > 0 ? '+' : ''}€{stats.sales.trend}M
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Quick Navigation -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<a href="/dashboard/properties" class="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm hover:bg-muted transition-colors">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
				<FolderOpen class="h-5 w-5 text-primary" />
			</div>
			<div>
				<h3 class="font-semibold">Propiedades</h3>
				<p class="text-sm text-muted-foreground">Gestionar inmuebles</p>
			</div>
		</a>
		<a href="/dashboard/clients" class="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm hover:bg-muted transition-colors">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/10">
				<Users class="h-5 w-5 text-green-600" />
			</div>
			<div>
				<h3 class="font-semibold">Clientes</h3>
				<p class="text-sm text-muted-foreground">CRM y leads</p>
			</div>
		</a>
		<a href="/dashboard/documents" class="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm hover:bg-muted transition-colors">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10">
				<FileText class="h-5 w-5 text-blue-600" />
			</div>
			<div>
				<h3 class="font-semibold">Documentos</h3>
				<p class="text-sm text-muted-foreground">Archivos y contratos</p>
			</div>
		</a>
		<a href="/dashboard/users" class="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm hover:bg-muted transition-colors">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-600/10">
				<BarChart3 class="h-5 w-5 text-yellow-600" />
			</div>
			<div>
				<h3 class="font-semibold">Reportes</h3>
				<p class="text-sm text-muted-foreground">Análisis y métricas</p>
			</div>
		</a>
	</div>

	<!-- Recent Activity -->
	<div class="rounded-lg border bg-card p-6 shadow-sm">
		<h3 class="text-lg font-semibold mb-4">Actividad Reciente</h3>
		<div class="space-y-3">
			<div class="flex items-center gap-3 text-sm">
				<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
					<FolderOpen class="h-4 w-4 text-primary" />
				</div>
				<div class="flex-1">
					<p class="font-medium">Nueva propiedad añadida</p>
					<p class="text-muted-foreground">Apartamento en Calle Principal, 123</p>
				</div>
				<span class="text-muted-foreground">hace 2h</span>
			</div>
			<div class="flex items-center gap-3 text-sm">
				<div class="flex h-8 w-8 items-center justify-center rounded-full bg-green-600/10">
					<Users class="h-4 w-4 text-green-600" />
				</div>
				<div class="flex-1">
					<p class="font-medium">Cliente interesado</p>
					<p class="text-muted-foreground">María García - Casa Residencial</p>
				</div>
				<span class="text-muted-foreground">hace 1d</span>
			</div>
			<div class="flex items-center gap-3 text-sm">
				<div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/10">
					<FileText class="h-4 w-4 text-blue-600" />
				</div>
				<div class="flex-1">
					<p class="font-medium">Contrato firmado</p>
					<p class="text-muted-foreground">Venta - Oficina Plaza Norte</p>
				</div>
				<span class="text-muted-foreground">hace 2d</span>
			</div>
		</div>
	</div>
</div>
