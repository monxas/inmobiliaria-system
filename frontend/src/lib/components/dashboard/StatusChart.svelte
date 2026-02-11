<script lang="ts">
	interface Props {
		stats: {
			total: number;
			available: number;
			sold: number;
			rented: number;
			reserved: number;
			offMarket: number;
		};
	}

	let { stats }: Props = $props();

	const segments = $derived([
		{ label: 'Disponible', value: stats.available, color: '#10b981' },
		{ label: 'Vendido', value: stats.sold, color: '#3b82f6' },
		{ label: 'Alquilado', value: stats.rented, color: '#8b5cf6' },
		{ label: 'Reservado', value: stats.reserved, color: '#f59e0b' },
		{ label: 'Fuera mercado', value: stats.offMarket, color: '#6b7280' },
	].filter(s => s.value > 0));

	const total = $derived(segments.reduce((s, seg) => s + seg.value, 0) || 1);

	// Calculate bar widths as percentages
	const bars = $derived(segments.map(s => ({
		...s,
		pct: Math.round((s.value / total) * 100)
	})));
</script>

<div class="rounded-lg border bg-card p-6">
	<div class="flex items-center justify-between mb-6">
		<h3 class="text-sm font-semibold">Propiedades por estado</h3>
		<span class="text-xs text-muted-foreground">{stats.total} total</span>
	</div>

	{#if segments.length === 0}
		<div class="flex items-center justify-center h-32 text-sm text-muted-foreground">
			No hay datos disponibles
		</div>
	{:else}
		<!-- Stacked bar -->
		<div class="flex rounded-full h-3 overflow-hidden mb-6">
			{#each bars as bar}
				<div
					class="transition-all duration-500"
					style="width: {bar.pct}%; background-color: {bar.color};"
					title="{bar.label}: {bar.value}"
				></div>
			{/each}
		</div>

		<!-- Legend -->
		<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
			{#each bars as bar}
				<div class="flex items-center gap-2">
					<div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {bar.color};"></div>
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground truncate">{bar.label}</p>
						<p class="text-sm font-medium">{bar.value} <span class="text-xs text-muted-foreground">({bar.pct}%)</span></p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
