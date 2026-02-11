<script lang="ts">
	import Button from '$ui/Button.svelte';

	interface ImageItem {
		id: number;
		url: string;
		thumbnail?: string;
		caption?: string;
	}

	interface Props {
		images: ImageItem[];
		editable?: boolean;
		ondelete?: (id: number) => void;
	}

	let { images = [], editable = false, ondelete }: Props = $props();

	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	function openLightbox(index: number) {
		lightboxIndex = index;
		lightboxOpen = true;
	}

	function closeLightbox() {
		lightboxOpen = false;
	}

	function prev() {
		lightboxIndex = (lightboxIndex - 1 + images.length) % images.length;
	}

	function next() {
		lightboxIndex = (lightboxIndex + 1) % images.length;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!lightboxOpen) return;
		if (e.key === 'Escape') closeLightbox();
		if (e.key === 'ArrowLeft') prev();
		if (e.key === 'ArrowRight') next();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if images.length === 0}
	<div class="flex h-48 items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 text-muted-foreground">
		<div class="text-center">
			<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
			<p class="mt-2 text-sm">Sin imágenes</p>
		</div>
	</div>
{:else}
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
		{#each images as image, i}
			<div class="group relative aspect-square overflow-hidden rounded-lg">
				<button onclick={() => openLightbox(i)} class="h-full w-full">
					<img
						src={image.thumbnail ?? image.url}
						alt={image.caption ?? `Imagen ${i + 1}`}
						class="h-full w-full object-cover transition-transform group-hover:scale-105"
					/>
				</button>
				{#if editable && ondelete}
					<button
						onclick={() => ondelete(image.id)}
						class="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<!-- Lightbox -->
{#if lightboxOpen && images.length > 0}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
		onclick={closeLightbox}
		role="dialog"
		aria-modal="true"
	>
		<button onclick|stopPropagation={prev} class="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
		</button>

		<img
			src={images[lightboxIndex].url}
			alt={images[lightboxIndex].caption ?? ''}
			class="max-h-[90vh] max-w-[90vw] object-contain"
			onclick|stopPropagation={() => {}}
		/>

		<button onclick|stopPropagation={next} class="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
		</button>

		<button onclick={closeLightbox} class="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>

		<div class="absolute bottom-4 text-sm text-white/70">
			{lightboxIndex + 1} / {images.length}
		</div>
	</div>
{/if}
