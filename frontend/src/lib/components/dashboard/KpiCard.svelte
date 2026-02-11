<script lang="ts">
	interface Props {
		title: string;
		value: number | string;
		subtitle?: string;
		icon?: 'building' | 'users' | 'file' | 'dollar';
		color?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';
		isText?: boolean;
	}

	let { title, value, subtitle = '', icon = 'building', color = 'blue', isText = false }: Props = $props();

	const colors: Record<string, { bg: string; text: string }> = {
		blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' },
		emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
		violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400' },
		amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400' },
		rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-600 dark:text-rose-400' },
	};

	const c = $derived(colors[color] || colors.blue);
</script>

<div class="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
	<div class="flex items-center justify-between">
		<p class="text-sm font-medium text-muted-foreground">{title}</p>
		<div class="rounded-lg p-2.5 {c.bg}">
			{#if icon === 'building'}
				<svg class="h-4 w-4 {c.text}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
			{:else if icon === 'users'}
				<svg class="h-4 w-4 {c.text}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
			{:else if icon === 'file'}
				<svg class="h-4 w-4 {c.text}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
			{:else if icon === 'dollar'}
				<svg class="h-4 w-4 {c.text}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			{/if}
		</div>
	</div>
	<div class="mt-3">
		<p class="text-2xl font-semibold tracking-tight">
			{isText ? value : typeof value === 'number' ? value.toLocaleString('es-ES') : value}
		</p>
		{#if subtitle}
			<p class="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
		{/if}
	</div>
</div>
