<script lang="ts">
	import { onMount } from 'svelte';
	import { documentsApi } from '$lib/api/client';
	import { toast } from '$lib/stores/toast';
	import type { Document, DocumentFilters, FileCategory } from '$types';
	import { FILE_CATEGORIES } from '$types';
	import { formatSize } from '$lib/utils/file-utils';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import DocumentCenter from '$lib/components/files/DocumentCenter.svelte';
	import FilePreview from '$lib/components/files/FilePreview.svelte';

	let documents = $state<Document[]>([]);
	let isLoading = $state(true);
	let previewFile = $state<Document | null>(null);
	let previewOpen = $state(false);

	// Stats
	let stats = $derived.by(() => {
		const total = documents.length;
		const totalSize = documents.reduce((sum, d) => sum + d.fileSize, 0);
		const byCategory: Record<string, number> = {};
		for (const doc of documents) {
			byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
		}
		return { total, totalSize, byCategory };
	});

	async function loadDocuments() {
		isLoading = true;
		try {
			const response = await documentsApi.list(1, 100);
			documents = response.data;
		} catch (err) {
			toast.error('Error al cargar documentos');
		} finally {
			isLoading = false;
		}
	}

	onMount(loadDocuments);
</script>

<svelte:head><title>Documentos | Inmobiliaria</title></svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold">Documentos</h1>
		<p class="mt-1 text-sm text-muted-foreground">Gestión centralizada de archivos y documentos.</p>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		<Card class="p-4">
			<p class="text-xs font-medium text-muted-foreground">Total Archivos</p>
			<p class="mt-1 text-2xl font-bold">{stats.total}</p>
		</Card>
		<Card class="p-4">
			<p class="text-xs font-medium text-muted-foreground">Almacenamiento</p>
			<p class="mt-1 text-2xl font-bold">{formatSize(stats.totalSize)}</p>
		</Card>
		<Card class="p-4">
			<p class="text-xs font-medium text-muted-foreground">Imágenes</p>
			<p class="mt-1 text-2xl font-bold">{stats.byCategory['property_images'] ?? 0}</p>
		</Card>
		<Card class="p-4">
			<p class="text-xs font-medium text-muted-foreground">Contratos</p>
			<p class="mt-1 text-2xl font-bold">{stats.byCategory['contracts'] ?? 0}</p>
		</Card>
	</div>

	<!-- Document Center -->
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		</div>
	{:else}
		<Card class="p-5">
			<DocumentCenter
				bind:documents
				showUpload={true}
				showFilters={true}
				onchange={loadDocuments}
			/>
		</Card>
	{/if}
</div>

<!-- Preview -->
<FilePreview
	file={previewFile}
	bind:open={previewOpen}
	onclose={() => previewFile = null}
/>
