<script lang="ts">
	import { formatSize, isImageType, isPdfType } from '$lib/utils/file-utils';
	import { formatDate } from '$lib/utils';
	import type { Document } from '$types';
	import Badge from '$lib/components/ui/Badge.svelte';

	interface Props {
		documents?: Document[];
		limit?: number;
		class?: string;
		onviewall?: () => void;
		onpreview?: (doc: Document) => void;
	}

	let {
		documents = [],
		limit = 5,
		class: className = '',
		onviewall,
		onpreview,
	}: Props = $props();

	let recent = $derived(
		[...documents]
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, limit)
	);

	function getIcon(doc: Document): string {
		if (isImageType(doc.mimeType)) return '🖼️';
		if (isPdfType(doc.mimeType)) return '📄';
		return '📎';
	}
</script>

<div class={className}>
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-sm font-semibold">Subidas Recientes</h3>
		{#if onviewall}
			<button class="text-xs text-primary hover:underline" onclick={onviewall}>
				Ver todos →
			</button>
		{/if}
	</div>

	{#if recent.length === 0}
		<p class="text-xs text-muted-foreground text-center py-4">Sin subidas recientes</p>
	{:else}
		<div class="space-y-2">
			{#each recent as doc (doc.id)}
				<button
					class="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-muted/50 transition-colors"
					onclick={() => onpreview?.(doc)}
				>
					<span class="text-lg">{getIcon(doc)}</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs font-medium">{doc.originalFilename}</p>
						<p class="text-[10px] text-muted-foreground">
							{formatSize(doc.fileSize)} · {formatDate(doc.createdAt)}
						</p>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
