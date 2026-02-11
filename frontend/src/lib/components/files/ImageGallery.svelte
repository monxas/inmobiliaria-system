<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatSize } from '$lib/utils/file-utils';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import FileUpload from './FileUpload.svelte';

	interface PropertyImage {
		id: number;
		filename: string;
		originalFilename: string;
		filePath: string;
		fileSize: number;
		mimeType: string;
		orderIndex: number;
		isPrimary: boolean;
		altText?: string | null;
		caption?: string | null;
		variants?: {
			thumbnail?: { path: string };
			medium?: { path: string };
			large?: { path: string };
		};
	}

	interface Props {
		propertyId: number;
		images?: PropertyImage[];
		editable?: boolean;
		class?: string;
		onchange?: (images: PropertyImage[]) => void;
		onpreview?: (image: PropertyImage) => void;
	}

	let {
		propertyId,
		images = $bindable([]),
		editable = true,
		class: className = '',
		onchange,
		onpreview,
	}: Props = $props();

	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);
	let showUpload = $state(false);
	let isDeleting = $state<number | null>(null);

	$effect(() => {
		// Sort by orderIndex
		images = [...images].sort((a, b) => a.orderIndex - b.orderIndex);
	});

	function getImageUrl(image: PropertyImage, variant: 'thumbnail' | 'medium' | 'large' | 'full' = 'medium'): string {
		const variantPath = image.variants?.[variant as keyof typeof image.variants]?.path;
		if (variantPath) return `/api/files/${variantPath}`;
		return `/api/files/${image.filePath}`;
	}

	// Drag & drop reorder
	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = index;
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === index) return;

		const reordered = [...images];
		const [moved] = reordered.splice(draggedIndex, 1);
		reordered.splice(index, 0, moved);

		// Update orderIndex
		images = reordered.map((img, i) => ({ ...img, orderIndex: i }));
		draggedIndex = null;
		dragOverIndex = null;
		onchange?.(images);
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	async function setPrimary(image: PropertyImage) {
		images = images.map(img => ({
			...img,
			isPrimary: img.id === image.id,
		}));
		onchange?.(images);
	}

	async function deleteImage(image: PropertyImage) {
		isDeleting = image.id;
		try {
			const token = localStorage.getItem('accessToken');
			const res = await fetch(`/api/properties/${propertyId}/images/${image.id}`, {
				method: 'DELETE',
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) {
				images = images.filter(img => img.id !== image.id);
				onchange?.(images);
			}
		} finally {
			isDeleting = null;
		}
	}

	function handleUploadComplete(docs: unknown[]) {
		// Refresh images from server
		showUpload = false;
		// Trigger parent to reload
		onchange?.(images);
	}
</script>

<div class={cn('space-y-4', className)}>
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-sm font-semibold">Galería de Imágenes</h3>
			<p class="text-xs text-muted-foreground">{images.length} imagen{images.length !== 1 ? 'es' : ''}</p>
		</div>
		{#if editable}
			<Button variant="outline" size="sm" onclick={() => showUpload = !showUpload}>
				<svg class="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Añadir Imágenes
			</Button>
		{/if}
	</div>

	<!-- Upload Area -->
	{#if showUpload && editable}
		<FileUpload
			accept="image/*"
			endpoint={`/properties/${propertyId}/images`}
			compressImages={true}
			onupload={handleUploadComplete}
		/>
	{/if}

	<!-- Image Grid -->
	{#if images.length > 0}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each images as image, index (image.id)}
				<div
					class={cn(
						'group relative aspect-square overflow-hidden rounded-lg border bg-muted cursor-pointer transition-all',
						dragOverIndex === index && 'ring-2 ring-primary scale-105',
						draggedIndex === index && 'opacity-50',
						image.isPrimary && 'ring-2 ring-primary'
					)}
					draggable={editable}
					ondragstart={() => handleDragStart(index)}
					ondragover={(e) => handleDragOver(e, index)}
					ondrop={(e) => handleDrop(e, index)}
					ondragend={handleDragEnd}
					onclick={() => onpreview?.(image)}
					role="button"
					tabindex="0"
				>
					<img
						src={getImageUrl(image, 'thumbnail')}
						alt={image.altText ?? image.originalFilename}
						class="h-full w-full object-cover"
						loading="lazy"
					/>

					<!-- Primary Badge -->
					{#if image.isPrimary}
						<Badge class="absolute left-1.5 top-1.5 text-[10px]">
							★ Principal
						</Badge>
					{/if}

					<!-- Overlay actions on hover -->
					{#if editable}
						<div class="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
							<div class="flex w-full items-center justify-between p-2">
								<div class="flex gap-1">
									{#if !image.isPrimary}
										<button
											class="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-800 hover:bg-white"
											onclick|stopPropagation={() => setPrimary(image)}
											title="Establecer como principal"
										>
											★
										</button>
									{/if}
								</div>
								<button
									class="rounded bg-red-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-600"
									onclick|stopPropagation={() => deleteImage(image)}
									disabled={isDeleting === image.id}
									title="Eliminar"
								>
									{isDeleting === image.id ? '...' : '✕'}
								</button>
							</div>
						</div>
					{/if}

					<!-- Drag handle indicator -->
					{#if editable}
						<div class="absolute right-1.5 top-1.5 rounded bg-black/30 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
							<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
							</svg>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else if !showUpload}
		<div class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
			<svg class="mb-2 h-10 w-10 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
			</svg>
			<p class="text-sm text-muted-foreground">No hay imágenes</p>
			{#if editable}
				<Button variant="outline" size="sm" class="mt-3" onclick={() => showUpload = true}>
					Subir Imágenes
				</Button>
			{/if}
		</div>
	{/if}
</div>
