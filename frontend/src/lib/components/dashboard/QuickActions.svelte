<script lang="ts">
	import { Building2, Users, Upload, FileText, UserPlus, Eye } from 'lucide-svelte';
	import type { UserRole } from '$types';

	interface Props {
		role: UserRole | string;
	}

	let { role }: Props = $props();

	const actions = $derived([
		...(role === 'admin' || role === 'agent'
			? [
				{ label: 'Nueva propiedad', href: '/properties/new', icon: Building2, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' },
				{ label: 'Nuevo cliente', href: '/clients/new', icon: UserPlus, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' },
				{ label: 'Subir documento', href: '/documents/upload', icon: Upload, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400' },
			]
			: []),
		{ label: 'Ver propiedades', href: '/properties', icon: Eye, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' },
		{ label: 'Mis documentos', href: '/documents', icon: FileText, color: 'bg-gray-50 text-gray-600 dark:bg-gray-950/30 dark:text-gray-400' },
	]);
</script>

<div class="rounded-lg border bg-card p-6">
	<h3 class="text-sm font-semibold mb-4">Acciones rápidas</h3>
	<div class="space-y-2">
		{#each actions as action}
			<a
				href={action.href}
				class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 transition-colors group"
			>
				<div class="rounded-lg p-2 {action.color} shrink-0">
					<action.icon class="h-4 w-4" />
				</div>
				<span class="text-sm font-medium group-hover:text-primary transition-colors">{action.label}</span>
			</a>
		{/each}
	</div>
</div>
