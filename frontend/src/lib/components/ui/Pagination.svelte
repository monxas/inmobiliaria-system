<script lang="ts">
	import Button from './Button.svelte';

	interface Props {
		page: number;
		totalPages: number;
		onPageChange: (page: number) => void;
	}

	let { page, totalPages, onPageChange }: Props = $props();

	function prevPage() {
		if (page > 1) onPageChange(page - 1);
	}

	function nextPage() {
		if (page < totalPages) onPageChange(page + 1);
	}

	function getVisiblePages(current: number, total: number): (number | '...')[] {
		if (total <= 7) {
			return Array.from({ length: total }, (_, i) => i + 1);
		}

		const pages: (number | '...')[] = [];

		if (current <= 3) {
			pages.push(1, 2, 3, 4, 5, '...', total);
		} else if (current >= total - 2) {
			pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
		} else {
			pages.push(1, '...', current - 1, current, current + 1, '...', total);
		}

		return pages;
	}

	let visiblePages = $derived(getVisiblePages(page, totalPages));
</script>

<div class="flex items-center gap-2">
	<Button variant="outline" size="sm" onclick={prevPage} disabled={page <= 1}>
		Anterior
	</Button>

	<div class="flex items-center gap-1">
		{#each visiblePages as p}
			{#if p === '...'}
				<span class="px-2">...</span>
			{:else}
				<Button
					variant={p === page ? 'default' : 'ghost'}
					size="sm"
					onclick={() => onPageChange(p)}
				>
					{p}
				</Button>
			{/if}
		{/each}
	</div>

	<Button variant="outline" size="sm" onclick={nextPage} disabled={page >= totalPages}>
		Siguiente
	</Button>
</div>
