<script lang="ts">
	interface Props {
		role: string;
	}

	let { role }: Props = $props();

	const isAgentOrAdmin = $derived(role === 'admin' || role === 'agent');

	interface Action {
		label: string;
		href: string;
		color: string;
		iconPath: string;
	}

	const actions = $derived<Action[]>([
		...(isAgentOrAdmin ? [
			{ label: 'Nueva propiedad', href: '/dashboard/properties?action=new', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400', iconPath: 'M12 4v16m8-8H4' },
			{ label: 'Nuevo cliente', href: '/dashboard/clients?action=new', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400', iconPath: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
			{ label: 'Subir documento', href: '/dashboard/documents?action=upload', color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400', iconPath: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
		] : []),
		{ label: 'Ver propiedades', href: '/dashboard/properties', color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400', iconPath: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
		{ label: 'Mis documentos', href: '/dashboard/documents', color: 'bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400', iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
	]);
</script>

<div class="rounded-xl border bg-card p-6 h-full">
	<h3 class="text-sm font-semibold mb-4">Acciones rápidas</h3>
	<div class="space-y-1.5">
		{#each actions as action}
			<a
				href={action.href}
				class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 transition-colors group"
			>
				<div class="rounded-lg p-2 {action.color} shrink-0">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d={action.iconPath} />
					</svg>
				</div>
				<span class="text-sm font-medium group-hover:text-primary transition-colors">{action.label}</span>
			</a>
		{/each}
	</div>
</div>
