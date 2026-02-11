<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatSize, validateFile, isImageType, generateThumbnail, compressImage } from '$lib/utils/file-utils';
	import { uploadQueue, uploadFiles, type UploadItem } from '$lib/stores/documents';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	interface Props {
		accept?: string;
		multiple?: boolean;
		maxFiles?: number;
		maxSize?: number; // bytes
		endpoint?: string;
		extraFields?: Record<string, string>;
		compressImages?: boolean;
		showQueue?: boolean;
		class?: string;
		onupload?: (docs: unknown[]) => void;
		onerror?: (error: string) => void;
	}

	let {
		accept = 'image/*,application/pdf,.doc,.docx',
		multiple = true,
		maxFiles = 20,
		maxSize,
		endpoint = '/documents/upload',
		extraFields = {},
		compressImages = true,
		showQueue = true,
		class: className = '',
		onupload,
		onerror,
	}: Props = $props();

	let dragActive = $state(false);
	let fileInput: HTMLInputElement;
	let isProcessing = $state(false);
	let localQueue: UploadItem[] = [];

	// Subscribe to upload queue
	uploadQueue.subscribe(items => { localQueue = items; });

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		dragActive = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		if (e.currentTarget === e.target) {
			dragActive = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragActive = false;
		const files = Array.from(e.dataTransfer?.files ?? []);
		await processFiles(files);
	}

	function handleInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		processFiles(files);
		input.value = '';
	}

	async function processFiles(files: File[]) {
		if (files.length === 0) return;

		if (files.length > maxFiles) {
			onerror?.(`Máximo ${maxFiles} archivos a la vez`);
			return;
		}

		isProcessing = true;
		const validFiles: File[] = [];
		const thumbnails = new Map<string, string>();

		for (const file of files) {
			const result = await validateFile(file, { maxSize });
			if (!result.valid) {
				onerror?.(`${file.name}: ${result.error}`);
				continue;
			}

			// Compress images client-side
			if (compressImages && isImageType(file.type) && file.type !== 'image/svg+xml') {
				try {
					const compressed = await compressImage(file);
					thumbnails.set(compressed.file.name, compressed.thumbnail);
					validFiles.push(compressed.file);
				} catch {
					// Fall back to original
					const thumb = await generateThumbnail(file).catch(() => undefined);
					if (thumb) thumbnails.set(file.name, thumb);
					validFiles.push(file);
				}
			} else {
				try {
					const thumb = await generateThumbnail(file);
					thumbnails.set(file.name, thumb);
				} catch { /* no thumbnail */ }
				validFiles.push(file);
			}
		}

		if (validFiles.length > 0) {
			const ids = uploadQueue.addFiles(validFiles, thumbnails);
			const items = localQueue.filter(i => ids.includes(i.id));
			
			// Start upload
			const results = await uploadFiles(items, endpoint, extraFields);
			if (results.length > 0) {
				onupload?.(results);
			}
		}

		isProcessing = false;
	}

	function retryItem(item: UploadItem) {
		uploadQueue.updateItem(item.id, { status: 'pending', error: undefined, progress: 0 });
		uploadFiles([item], endpoint, extraFields).then(results => {
			if (results.length > 0) onupload?.(results);
		});
	}

	const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
		pending: 'secondary',
		uploading: 'default',
		compressing: 'secondary',
		done: 'default',
		error: 'destructive',
	};

	const statusLabels: Record<string, string> = {
		pending: 'Pendiente',
		uploading: 'Subiendo',
		compressing: 'Comprimiendo',
		done: 'Completado',
		error: 'Error',
	};
</script>

<div class={cn('space-y-4', className)}>
	<!-- Drop Zone -->
	<button
		type="button"
		class={cn(
			'relative flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
			dragActive
				? 'border-primary bg-primary/5 scale-[1.01]'
				: 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
		)}
		ondragenter={handleDragEnter}
		ondragleave={handleDragLeave}
		ondragover={handleDragOver}
		ondrop={handleDrop}
		onclick={() => fileInput?.click()}
		disabled={isProcessing}
	>
		<!-- Upload Icon -->
		<div class={cn('mb-3 rounded-full p-3', dragActive ? 'bg-primary/10' : 'bg-muted')}>
			<svg class={cn('h-8 w-8', dragActive ? 'text-primary' : 'text-muted-foreground')} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
			</svg>
		</div>

		{#if isProcessing}
			<p class="text-sm font-medium text-muted-foreground">Procesando archivos...</p>
		{:else if dragActive}
			<p class="text-sm font-medium text-primary">Suelta los archivos aquí</p>
		{:else}
			<p class="text-sm font-medium">
				Arrastra archivos aquí o <span class="text-primary">haz clic para seleccionar</span>
			</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{#if maxSize}Máx. {formatSize(maxSize)} por archivo · {/if}
				{multiple ? `Hasta ${maxFiles} archivos` : '1 archivo'}
			</p>
		{/if}
	</button>

	<!-- Hidden File Input -->
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		{multiple}
		class="hidden"
		onchange={handleInputChange}
	/>

	<!-- Upload Queue -->
	{#if showQueue && localQueue.length > 0}
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-muted-foreground">
					{localQueue.filter(i => i.status === 'done').length}/{localQueue.length} completados
				</span>
				<Button variant="ghost" size="sm" onclick={() => uploadQueue.clearCompleted()}>
					Limpiar completados
				</Button>
			</div>

			{#each localQueue as item (item.id)}
				<div class="flex items-center gap-3 rounded-md border bg-card p-3">
					<!-- Thumbnail -->
					<div class="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
						{#if item.thumbnail}
							<img src={item.thumbnail} alt="" class="h-full w-full object-cover" />
						{:else}
							<div class="flex h-full w-full items-center justify-center text-lg">📎</div>
						{/if}
					</div>

					<!-- Info -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="truncate text-sm font-medium">{item.name}</span>
							<Badge variant={statusColors[item.status]} class="text-[10px]">
								{statusLabels[item.status]}
							</Badge>
						</div>
						<div class="text-xs text-muted-foreground">{formatSize(item.size)}</div>

						{#if item.status === 'uploading'}
							<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
								<div
									class="h-full rounded-full bg-primary transition-all duration-300"
									style="width: {item.progress}%"
								></div>
							</div>
						{/if}

						{#if item.error}
							<p class="mt-0.5 text-xs text-destructive">{item.error}</p>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex-shrink-0">
						{#if item.status === 'error'}
							<Button variant="ghost" size="icon" onclick={() => retryItem(item)} title="Reintentar">
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
								</svg>
							</Button>
						{/if}
						<Button variant="ghost" size="icon" onclick={() => uploadQueue.removeItem(item.id)} title="Eliminar">
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
							</svg>
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
