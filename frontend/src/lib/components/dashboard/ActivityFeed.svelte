<script lang="ts">
	import { formatDate } from '$lib/utils';
	import { ArrowRight, Clock } from 'lucide-svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	interface FeedItem {
		id: number;
		title: string;
		subtitle: string;
		status?: string;
		date: string;
		href?: string;
	}

	interface Props {
		title: string;
		items: FeedItem[];
		emptyText?: string;
		viewAllHref?: string;
	}

	let { title, items, emptyText = 'Sin datos', viewAllHref }: Props = $props();

	const statusColors: Record<string, string> = {
		available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
		sold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
		rented: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
		reserved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		off_market: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
	};

	const statusLabels: Record<string, string> = {
		available: 'Disponible',
		sold: 'Vendido',
		rented: 'Alquilado',
		reserved: 'Reservado',
		off_market: 'Fuera mercado',
	};

	function timeAgo(date: string): string {
		const now = Date.now();
		const diff = now - new Date(date).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Ahora';
		if (mins < 60) return `${mins}m`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d`;
		return formatDate(date);
	}
</script>

<div class="rounded-lg border bg-card">
	<div class="flex items-center justify-between px-6 py-4 border-b">
		<h3 class="text-sm font-semibold">{title}</h3>
		{#if viewAllHref}
			<a href={viewAllHref} class="text-xs text-primary hover:underline inline-flex items-center gap-1">
				Ver todo <ArrowRight class="h-3 w-3" />
			</a>
		{/if}
	</div>

	{#if items.length === 0}
		<div class="flex items-center justify-center py-12 text-sm text-muted-foreground">
			{emptyText}
		</div>
	{:else}
		<ul class="divide-y">
			{#each items as item}
				<li>
					<a
						href={item.href || '#'}
						class="flex items-center justify-between px-6 py-3.5 hover:bg-accent/50 transition-colors group"
					>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium truncate group-hover:text-primary transition-colors">
								{item.title}
							</p>
							<p class="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
						</div>
						<div class="flex items-center gap-2 ml-3 shrink-0">
							{#if item.status && statusLabels[item.status]}
								<span class="text-[10px] font-medium px-2 py-0.5 rounded-full {statusColors[item.status] || ''}">
									{statusLabels[item.status]}
								</span>
							{/if}
							<span class="text-[10px] text-muted-foreground flex items-center gap-1">
								<Clock class="h-3 w-3" />
								{timeAgo(item.date)}
							</span>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
