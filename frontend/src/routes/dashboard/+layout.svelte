<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { auth, user, isAuthenticated, isLoading, isAdmin } from '$stores/auth-simple';
	import { toast } from '$stores/toast';
	
	// Lucide icons
	import { Home, Building, Users, File, Shield, Menu, ChevronDown, User, Settings, LogOut, CalendarDays } from 'lucide-svelte';

	let { children } = $props();
	let sidebarOpen = $state(true);
	let userMenuOpen = $state(false);

	// Protected route guard
	$effect(() => {
		if (browser && !$isLoading && !$isAuthenticated) {
			goto('/auth/login');
		}
	});

	async function handleLogout() {
		await auth.logout();
		toast.info('Sesión cerrada');
		goto('/auth/login');
	}

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'home' },
		{ href: '/dashboard/properties', label: 'Propiedades', icon: 'building' },
		{ href: '/dashboard/clients', label: 'Clientes', icon: 'users' },
		{ href: '/dashboard/calendar', label: 'Calendario', icon: 'calendar' },
		{ href: '/dashboard/documents', label: 'Documentos', icon: 'file' },
		{ href: '/dashboard/communications', label: 'Comunicaciones', icon: 'message' },
	];

	const adminItems = [
		{ href: '/dashboard/users', label: 'Usuarios', icon: 'shield' },
	];

	function isActive(href: string): boolean {
		if (href === '/dashboard') return $page.url.pathname === '/dashboard';
		return $page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>Panel | Inmobiliaria</title>
</svelte:head>

{#if $isLoading}
	<div class="flex h-screen items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
	</div>
{:else if $isAuthenticated}
	<div class="flex h-screen overflow-hidden">
		<!-- Mobile overlay -->
		{#if sidebarOpen}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-40 bg-black/50 md:hidden" onclick={() => sidebarOpen = false}></div>
		{/if}

		<!-- Sidebar -->
		<aside
			class="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r bg-card transition-transform duration-200 md:static md:z-0 md:translate-x-0"
			class:translate-x-0={sidebarOpen}
			class:-translate-x-full={!sidebarOpen}
		>
			<!-- Logo -->
			<div class="flex h-16 items-center gap-3 border-b px-4">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
					I
				</div>
				<span class="font-semibold text-foreground">Inmobiliaria</span>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 overflow-y-auto p-3 space-y-1">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(item.href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						{#if item.icon === 'home'}
							<Home class="h-4 w-4" />
						{:else if item.icon === 'building'}
							<Building class="h-4 w-4" />
						{:else if item.icon === 'calendar'}
							<CalendarDays class="h-4 w-4" />
						{:else if item.icon === 'users'}
							<Users class="h-4 w-4" />
						{:else if item.icon === 'file'}
							<File class="h-4 w-4" />
						{:else if item.icon === 'message'}
							<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
							</svg>
						{/if}
						{item.label}
					</a>
				{/each}

				{#if $isAdmin}
					<div class="my-3 border-t"></div>
					<p class="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
					{#each adminItems as item}
						<a
							href={item.href}
							class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(item.href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
						>
							<Shield class="h-4 w-4" />
							{item.label}
						</a>
					{/each}
				{/if}
			</nav>

			<!-- User section at bottom -->
			<div class="border-t p-3">
				<div class="flex items-center gap-3 rounded-lg px-3 py-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
						{$user?.fullName?.charAt(0) ?? '?'}
					</div>
					<div class="flex-1 min-w-0">
						<p class="truncate text-sm font-medium">{$user?.fullName ?? 'Usuario'}</p>
						<p class="truncate text-xs text-muted-foreground">{$user?.role ?? ''}</p>
					</div>
				</div>
			</div>
		</aside>

		<!-- Main content -->
		<div class="flex flex-1 flex-col overflow-hidden md:ml-0">
			<!-- Header -->
			<header class="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
				<button
					onclick={() => sidebarOpen = !sidebarOpen}
					class="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
				>
					<Menu class="h-5 w-5" />
				</button>

				<div class="flex-1"></div>

				<!-- User menu -->
				<div class="relative">
					<button
						onclick={() => userMenuOpen = !userMenuOpen}
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<div class="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
							{$user?.fullName?.charAt(0) ?? '?'}
						</div>
						<span class="hidden sm:inline">{$user?.fullName ?? 'Usuario'}</span>
						<ChevronDown class="h-4 w-4" />
					</button>

					{#if userMenuOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="fixed inset-0 z-40" onclick={() => userMenuOpen = false}></div>
						<div class="absolute right-0 z-50 mt-1 w-48 rounded-lg border bg-card py-1 shadow-lg">
							<div class="border-b px-3 py-2">
								<p class="text-sm font-medium">{$user?.fullName}</p>
								<p class="text-xs text-muted-foreground">{$user?.email}</p>
							</div>
							<a href="/dashboard/profile" class="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onclick={() => userMenuOpen = false}>
								<User class="h-4 w-4" />
								Perfil
							</a>
							<a href="/dashboard/settings" class="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onclick={() => userMenuOpen = false}>
								<Settings class="h-4 w-4" />
								Configuración
							</a>
							<div class="border-t">
								<button
									onclick={handleLogout}
									class="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
								>
									<LogOut class="h-4 w-4" />
									Cerrar Sesión
								</button>
							</div>
						</div>
					{/if}
				</div>
			</header>

			<!-- Page content -->
			<main class="flex-1 overflow-y-auto p-4 lg:p-6">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
