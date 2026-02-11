<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatSize, isImageType, isPdfType, isPreviewable, getFileIcon } from '$lib/utils/file-utils';
	import { formatDate, formatDateTime } from '$lib/utils';
	import type { Document, FileCategory } from '$types';
	import { FILE_CATEGORIES } from '$types';
	import { documentsApi } from '$lib/api/client';
	import { toast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import FileUpload from './FileUpload.svelte';
	import FilePreview from './FilePreview.svelte';
	import ShareLinkGenerator from './ShareLinkGenerator.svelte';

	interface Props {
		documents?: Document[];
		propertyId?: number;
		clientId?: number;
		showUpload?: boolean;
		showFilters?: boolean;
		class?: string;
		onchange?: () => void;
	}

	let {
		documents = $bindable([]),
		propertyId,
		clientId,
		showUpload = true,
		showFilters = true,
		class: className = '',
		onchange,
	}: Props = $props();

	let view = $state<'grid' | 'list'>('list');
	let categoryFilter = $state('');
	let searchQuery = $state('');
	let sortBy = $state<'date' | 'name' | 'size'>('date');
	let previewFile = $state<Document | null>(null);
	let previewOpen = $state(false);
	let shareDoc = $state<Document | null>(null);
	let shareOpen = $state(false);
	let isDeleting = $state<number | null>(null);
	let showUploadArea = $state(false);

	// Build extra fields for upload
	let uploadExtraFields = $derived.by(() => {
		const fields: Record<string, string> = {};
		if (propertyId) fields.propertyId = String(propertyId);
		if (clientId) fields.clientId = String(clientId);
		if (categoryFilter) fields.category = categoryFilter;
		return fields;
	});

	// Filtered & sorted documents
	let filteredDocs = $derived.by(() => {
		let docs = [...documents];
		
		if (categoryFilter) {
			docs = docs.filter(d => d.category === categoryFilter);
		}
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			docs = docs.filter(d => 
				d.originalFilename.toLowerCase().includes(q) ||
				d.filename.toLowerCase().includes(q)
			);
		}

		docs.sort((a, b) => {
			switch (sortBy) {
				case 'name': return a.originalFilename.localeCompare(b.originalFilename);
				case 'size': return b.fileSize - a.fileSize;
				default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			}
		});

		return docs;
	});

	// Group by category for grid view
	let groupedDocs = $derived.by(() => {
		const groups: Record<string, Document[]> = {};
		for (const doc of filteredDocs) {
			const cat = doc.category ?? 'other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(doc);
		}
		return groups;
	});

	function getCategoryLabel(cat: string): string {
		return FILE_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
	}

	function getCategoryColor(cat: FileCategory): string {
		const colors: Record<string, string> = {
			property_docs: 'bg-blue-100 text-blue-800',
			property_images: 'bg-green-100 text-green-800',
			client_docs: 'bg-purple-100 text-purple-800',
			contracts: 'bg-amber-100 text-amber-800',
			other: 'bg-gray-100 text-gray-800',
		};
		return colors[cat] ?? colors.other;
	}

	function getDocIcon(doc: Document): string {
		if (isImageType(doc.mimeType)) return '🖼️';
		if (isPdfType(doc.mimeType)) return '📄';
		if (doc.mimeType.includes('word')) return '📝';
		if (doc.mimeType.includes('zip')) return '📦';
		return '📎';
	}

	function openPreview(doc: Document) {
		previewFile = doc;
		previewOpen = true;
	}

	function openShare(doc: Document) {
		shareDoc = doc;
		shareOpen = true;
	}

	async function deleteDocument(doc: Document) {
		if (!confirm(`¿Eliminar "${doc.originalFilename}"?`)) return;
		isDeleting = doc.id;
		try {
			await documentsApi.delete(doc.id);
			documents = documents.filter(d => d.id !== doc.id);
			toast.success('Documento eliminado');
			onchange?.();
		} catch (err) {
			toast.error('Error al eliminar documento');
		} finally {
			isDeleting = null;
		}
	}

	function handleUploadDone(results: unknown[]) {
		showUploadArea = false;
		toast.success(`${results.length} archivo(s) subido(s)`);
		onchange?.();
	}
</script>

<div class={cn('space-y-4', className)}>
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-3">
		{#if showUpload}
			<Button variant={showUploadArea ? 'secondary' : 'default'} size="sm" onclick={() => showUploadArea = !showUploadArea}>
				<svg class="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
				</svg>
				Subir Archivos
			</Button>
		{/if}

		<div class="flex-1"></div>

		{#if showFilters}
			<Input
				placeholder="Buscar documentos..."
				bind:value={searchQuery}
				class="h-8 w-48 text-xs"
			/>

			<Select
				options={[{ value: '', label: 'Todas las categorías' }, ...FILE_CATEGORIES]}
				bind:value={categoryFilter}
				class="h-8 w-44 text-xs"
			/>

			<Select
				options={[
					{ value: 'date', label: 'Fecha' },
					{ value: 'name', label: 'Nombre' },
					{ value: 'size', label: 'Tamaño' },
				]}
				bind:value={sortBy}
				class="h-8 w-28 text-xs"
			/>
		{/if}

		<!-- View Toggle -->
		<div class="flex items-center rounded-md border">
			<button
				class={cn('p-1.5 transition-colors', view === 'list' ? 'bg-muted' : 'hover:bg-muted/50')}
				onclick={() => view = 'list'}
				title="Lista"
			>
				<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
				</svg>
			</button>
			<button
				class={cn('p-1.5 transition-colors', view === 'grid' ? 'bg-muted' : 'hover:bg-muted/50')}
				onclick={() => view = 'grid'}
				title="Cuadrícula"
			>
				<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Upload Area -->
	{#if showUploadArea}
		<FileUpload
			endpoint="/documents/upload"
			extraFields={uploadExtraFields}
			onupload={handleUploadDone}
			onerror={(err) => toast.error(err)}
		/>
	{/if}

	<!-- Document Count -->
	<p class="text-xs text-muted-foreground">
		{filteredDocs.length} documento{filteredDocs.length !== 1 ? 's' : ''}
		{#if categoryFilter || searchQuery} (filtrado){/if}
	</p>

	<!-- List View -->
	{#if view === 'list'}
		{#if filteredDocs.length === 0}
			<div class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
				<div class="text-4xl mb-2">📂</div>
				<p class="text-sm text-muted-foreground">No hay documentos</p>
			</div>
		{:else}
			<div class="divide-y rounded-lg border">
				{#each filteredDocs as doc (doc.id)}
					<div class="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
						<!-- Icon -->
						<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
							{getDocIcon(doc)}
						</div>

						<!-- Info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<button
									class="truncate text-sm font-medium hover:text-primary hover:underline"
									onclick={() => isPreviewable(doc.mimeType) ? openPreview(doc) : null}
								>
									{doc.originalFilename}
								</button>
								<span class={cn('inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium', getCategoryColor(doc.category))}>
									{getCategoryLabel(doc.category)}
								</span>
							</div>
							<div class="flex items-center gap-3 text-xs text-muted-foreground">
								<span>{formatSize(doc.fileSize)}</span>
								<span>{formatDate(doc.createdAt)}</span>
							</div>
						</div>

						<!-- Actions -->
						<div class="flex items-center gap-1">
							{#if isPreviewable(doc.mimeType)}
								<Button variant="ghost" size="icon" onclick={() => openPreview(doc)} title="Vista previa">
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
										<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
									</svg>
								</Button>
							{/if}
							<Button variant="ghost" size="icon" onclick={() => openShare(doc)} title="Compartir">
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
								</svg>
							</Button>
							<a
								href={documentsApi.getDownloadUrl(doc.id)}
								class="inline-flex h-10 w-10 items-center justify-center rounded-md text-sm hover:bg-accent hover:text-accent-foreground"
								title="Descargar"
								download
							>
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
								</svg>
							</a>
							<Button
								variant="ghost"
								size="icon"
								onclick={() => deleteDocument(doc)}
								disabled={isDeleting === doc.id}
								title="Eliminar"
							>
								<svg class="h-4 w-4 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
								</svg>
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

	{:else}
		<!-- Grid View - grouped by category -->
		{#each Object.entries(groupedDocs) as [category, docs] (category)}
			<div>
				<h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{getCategoryLabel(category)} ({docs.length})
				</h4>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each docs as doc (doc.id)}
						<button
							class="group flex flex-col items-center rounded-lg border p-3 text-center hover:bg-muted/30 hover:border-primary/30 transition-all"
							onclick={() => isPreviewable(doc.mimeType) ? openPreview(doc) : null}
						>
							<div class="mb-2 text-3xl">{getDocIcon(doc)}</div>
							<p class="w-full truncate text-xs font-medium">{doc.originalFilename}</p>
							<p class="text-[10px] text-muted-foreground">{formatSize(doc.fileSize)}</p>
						</button>
					{/each}
				</div>
			</div>
		{/each}

		{#if filteredDocs.length === 0}
			<div class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
				<div class="text-4xl mb-2">📂</div>
				<p class="text-sm text-muted-foreground">No hay documentos</p>
			</div>
		{/if}
	{/if}
</div>

<!-- Preview Modal -->
<FilePreview
	file={previewFile}
	bind:open={previewOpen}
	onclose={() => previewFile = null}
/>

<!-- Share Modal -->
{#if shareDoc}
	<ShareLinkGenerator
		document={shareDoc}
		bind:open={shareOpen}
		onclose={() => shareDoc = null}
	/>
{/if}
