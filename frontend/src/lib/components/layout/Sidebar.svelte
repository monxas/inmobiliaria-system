<script lang="ts">
	import { page } from '$app/stores';
	import { auth, user, isAdmin } from '$lib/stores/auth';
	import {
		LayoutDashboard, Building2, Users, FileText, Settings, LogOut,
		ChevronLeft, UserCog, Menu
	} from 'lucide-svelte';

	let collapsed = $state(false);
	let mobileOpen = $state(false);

	const navItems = $derived([
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/properties', label: 'Propiedades', icon: Building2 },
		{ href: '/clients', label: 'Clientes', icon: Users },
		{ href: '/documents', label: 'Documentos', icon: FileText },
		...($isAdmin ? [{ href: '/users', label: 'Usuarios', icon: UserCog }] : []),
		{ href: '/settings', label: 'Configuración', icon: Settings },
	]);

	function isActive(href: string) {
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}

	async function handleLogout() {
		await auth.logout();
		window.location.href = '/auth/login';
	}
</script>

<!-- Mobile toggle -->
<button
	class="fixed top-4 left-4 z-50 lg:hidden rounded-md p-2 bg-card border shadow-sm"
	onclick={() => mobileOpen = !mobileOpen}
>
	<Menu class="h-5 w-5" />
</button>

<!-- Overlay -->
{#if mobileOpen}
	<button
		class="fixed inset-0 bg-black/50 z-40 lg:hidden"
		onclick={() => mobileOpen = false}
	></button>
{/if}

<!-- Sidebar -->
<aside
	class="fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all duration-200
		{collapsed ? 'w-16' : 'w-64'}
		{mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}"
>
	<!-- Logo -->
	<div class="flex items-center h-16 px-4 border-b gap-3">
		<div class="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
			IM
		</div>
		{#if !collapsed}
			<span class="font-semibold text-sm truncate">Inmobiliaria</span>
		{/if}
	</div>

	<!-- Nav -->
	<nav class="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
					{isActive(item.href)
						? 'bg-primary/10 text-primary'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
				onclick={() => mobileOpen = false}
			>
				<item.icon class="h-5 w-5 shrink-0" />
				{#if !collapsed}
					<span class="truncate">{item.label}</span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- User + Collapse -->
	<div class="border-t p-3 space-y-2">
		{#if !collapsed && $user}
			<div class="flex items-center gap-3 px-2 py-1.5">
				<div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
					{$user.fullName?.charAt(0)?.toUpperCase() || '?'}
				</div>
				<div class="min-w-0">
					<p class="text-sm font-medium truncate">{$user.fullName}</p>
					<p class="text-xs text-muted-foreground truncate capitalize">{$user.role}</p>
				</div>
			</div>
		{/if}

		<div class="flex items-center {collapsed ? 'justify-center' : 'justify-between'} px-1">
			<button
				onclick={handleLogout}
				class="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-destructive rounded-md transition-colors"
				title="Cerrar sesión"
			>
				<LogOut class="h-4 w-4" />
				{#if !collapsed}<span>Salir</span>{/if}
			</button>

			<button
				onclick={() => collapsed = !collapsed}
				class="hidden lg:flex p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
				title={collapsed ? 'Expandir' : 'Colapsar'}
			>
				<ChevronLeft class="h-4 w-4 transition-transform {collapsed ? 'rotate-180' : ''}" />
			</button>
		</div>
	</div>
</aside>
