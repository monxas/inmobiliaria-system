<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { auth, user, isAuthenticated, isLoading, isAdmin } from '$stores/auth';
	import { toast } from '$stores/toast';

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
		{ href: '/dashboard/documents', label: 'Documentos', icon: 'file' },
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
		<!-- Sidebar -->
		<aside
			class="flex w-64 flex-col border-r bg-card transition-all duration-200"
			class:w-64={sidebarOpen}
			class:-ml-64={!sidebarOpen}
			class:md:ml-0={true}
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
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
						{:else if item.icon === 'building'}
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
						{:else if item.icon === 'users'}
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
						{:else if item.icon === 'file'}
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
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
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Header -->
			<header class="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
				<button
					onclick={() => sidebarOpen = !sidebarOpen}
					class="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
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
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
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
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
								Perfil
							</a>
							<a href="/dashboard/settings" class="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onclick={() => userMenuOpen = false}>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
								Configuración
							</a>
							<div class="border-t">
								<button
									onclick={handleLogout}
									class="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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
