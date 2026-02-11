<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatSize, isImageType, isPdfType } from '$lib/utils/file-utils';
	import { formatDateTime } from '$lib/utils';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	interface PreviewFile {
		id?: number;
		filename: string;
		originalFilename?: string;
		filePath?: string;
		fileSize?: number;
		mimeType: string;
		url?: string; // Direct URL override
		createdAt?: string;
	}

	interface Props {
		file?: PreviewFile | null;
		open?: boolean;
		onclose?: () => void;
	}

	let {
		file = null,
		open = $bindable(false),
		onclose,
	}: Props = $props();

	let zoom = $state(1);
	let isLoading = $state(true);

	$effect(() => {
		if (open) {
			zoom = 1;
			isLoading = true;
		}
	});

	function getFileUrl(f: PreviewFile): string {
		if (f.url) return f.url;
		if (f.filePath) return `/api/files/${f.filePath}`;
		return '';
	}

	function handleDownload() {
		if (!file) return;
		const url = file.id ? `/api/documents/${file.id}/download` : getFileUrl(file);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.originalFilename ?? file.filename;
		a.click();
	}

	function zoomIn() { zoom = Math.min(zoom + 0.25, 3); }
	function zoomOut() { zoom = Math.max(zoom - 0.25, 0.25); }
	function resetZoom() { zoom = 1; }
</script>

<Modal bind:open title="" size="xl" {onclose}>
	{#if file}
		<div class="flex flex-col gap-4">
			<!-- Header with file info -->
			<div class="flex items-center justify-between border-b pb-3">
				<div class="min-w-0">
					<h3 class="truncate text-base font-semibold">{file.originalFilename ?? file.filename}</h3>
					<div class="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
						{#if file.fileSize}<span>{formatSize(file.fileSize)}</span>{/if}
						<span>{file.mimeType}</span>
						{#if file.createdAt}<span>{formatDateTime(file.createdAt)}</span>{/if}
					</div>
				</div>
				<div class="flex items-center gap-1">
					{#if isImageType(file.mimeType)}
						<Button variant="ghost" size="icon" onclick={zoomOut} title="Alejar">
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6" />
							</svg>
						</Button>
						<button class="px-2 text-xs text-muted-foreground hover:text-foreground" onclick={resetZoom}>
							{Math.round(zoom * 100)}%
						</button>
						<Button variant="ghost" size="icon" onclick={zoomIn} title="Acercar">
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
							</svg>
						</Button>
					{/if}
					<Button variant="outline" size="sm" onclick={handleDownload}>
						<svg class="mr-1.5 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
						</svg>
						Descargar
					</Button>
				</div>
			</div>

			<!-- Preview Content -->
			<div class="relative flex min-h-[400px] max-h-[70vh] items-center justify-center overflow-auto rounded-lg bg-muted/30">
				{#if isLoading}
					<div class="absolute inset-0 flex items-center justify-center">
						<svg class="h-8 w-8 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
				{/if}

				{#if isImageType(file.mimeType)}
					<img
						src={getFileUrl(file)}
						alt={file.originalFilename ?? file.filename}
						class="max-w-full transition-transform duration-200"
						style="transform: scale({zoom})"
						onload={() => isLoading = false}
						onerror={() => isLoading = false}
					/>
				{:else if isPdfType(file.mimeType)}
					<iframe
						src={getFileUrl(file)}
						title={file.filename}
						class="h-full min-h-[500px] w-full border-0"
						onload={() => isLoading = false}
					></iframe>
				{:else}
					<!-- Unsupported preview -->
					<div class="flex flex-col items-center gap-3 p-8 text-center">
						<div class="text-5xl">📄</div>
						<p class="text-sm text-muted-foreground">
							Vista previa no disponible para este tipo de archivo
						</p>
						<Button variant="outline" onclick={handleDownload}>
							Descargar archivo
						</Button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</Modal>
