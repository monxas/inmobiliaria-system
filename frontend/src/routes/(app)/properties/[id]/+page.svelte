<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { properties } from '$stores/properties';
	import { PROPERTY_STATUSES, PROPERTY_TYPES } from '$types';
	import { formatCurrency, formatDate } from '$lib/utils';
	import Button from '$ui/Button.svelte';
	import Badge from '$ui/Badge.svelte';
	import Card from '$ui/Card.svelte';
	import Modal from '$ui/Modal.svelte';
	import ImageGallery from '$lib/components/properties/ImageGallery.svelte';
	import FileUpload from '$lib/components/properties/FileUpload.svelte';

	const id = $derived(Number($page.params.id));
	let deleteModal = $state(false);
	let showUpload = $state(false);

	onMount(() => {
		properties.fetchOne(id);
	});

	const property = $derived($properties.selected);
	const statusInfo = $derived(property ? PROPERTY_STATUSES.find((s) => s.value === property.status) : null);
	const typeInfo = $derived(property ? PROPERTY_TYPES.find((t) => t.value === property.propertyType) : null);

	async function handleDelete() {
		await properties.remove(id);
		goto('/properties');
	}

	// Placeholder images (until backend has real images)
	const images: any[] = [];
</script>

<svelte:head>
	<title>{property?.title ?? 'Propiedad'} | Inmobiliaria</title>
</svelte:head>

{#if $properties.loading && !property}
	<div class="flex h-64 items-center justify-center">
		<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
	</div>
{:else if property}
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<div class="mb-2 flex items-center gap-2">
					<Button variant="ghost" size="sm" onclick={() => goto('/properties')}>
						<svg xmlns="http://www.w3.org/2000/svg" class="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
						Volver
					</Button>
				</div>
				<h1 class="text-2xl font-bold">{property.title}</h1>
				<p class="text-muted-foreground">{property.address}, {property.city}</p>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={() => goto(`/properties/${id}/edit`)}>
					<svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
					Editar
				</Button>
				<Button variant="destructive" onclick={() => (deleteModal = true)}>Eliminar</Button>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Main content -->
			<div class="space-y-6 lg:col-span-2">
				<!-- Image Gallery -->
				<Card class="p-4">
					<div class="mb-3 flex items-center justify-between">
						<h2 class="text-lg font-semibold">Imágenes</h2>
						<Button variant="outline" size="sm" onclick={() => (showUpload = !showUpload)}>
							{showUpload ? 'Cerrar' : 'Subir imágenes'}
						</Button>
					</div>
					{#if showUpload}
						<div class="mb-4">
							<FileUpload propertyId={id} onuploaded={() => properties.fetchOne(id)} />
						</div>
					{/if}
					<ImageGallery {images} editable />
				</Card>

				<!-- Description -->
				{#if property.description}
					<Card class="p-4">
						<h2 class="mb-2 text-lg font-semibold">Descripción</h2>
						<p class="whitespace-pre-wrap text-sm text-muted-foreground">{property.description}</p>
					</Card>
				{/if}

				<!-- Documents -->
				<Card class="p-4">
					<div class="mb-3 flex items-center justify-between">
						<h2 class="text-lg font-semibold">Documentos</h2>
						<Button variant="outline" size="sm">Subir documento</Button>
					</div>
					<FileUpload propertyId={id} accept=".pdf,.doc,.docx,.xls,.xlsx" category="property_docs" />
				</Card>
			</div>

			<!-- Sidebar -->
			<div class="space-y-4">
				<!-- Price & Status -->
				<Card class="p-4">
					<div class="mb-3 text-3xl font-bold text-primary">{formatCurrency(property.price)}</div>
					<div class="flex gap-2">
						{#if statusInfo}
							<Badge class={statusInfo.color}>{statusInfo.label}</Badge>
						{/if}
						<Badge variant="outline">{typeInfo?.label ?? property.propertyType}</Badge>
					</div>
				</Card>

				<!-- Details -->
				<Card class="p-4">
					<h3 class="mb-3 font-semibold">Detalles</h3>
					<dl class="space-y-2 text-sm">
						{#if property.surfaceArea}
							<div class="flex justify-between">
								<dt class="text-muted-foreground">Superficie</dt>
								<dd class="font-medium">{property.surfaceArea} m²</dd>
							</div>
						{/if}
						{#if property.bedrooms}
							<div class="flex justify-between">
								<dt class="text-muted-foreground">Habitaciones</dt>
								<dd class="font-medium">{property.bedrooms}</dd>
							</div>
						{/if}
						{#if property.bathrooms}
							<div class="flex justify-between">
								<dt class="text-muted-foreground">Baños</dt>
								<dd class="font-medium">{property.bathrooms}</dd>
							</div>
						{/if}
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Garaje</dt>
							<dd class="font-medium">{property.garage ? 'Sí' : 'No'}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Jardín</dt>
							<dd class="font-medium">{property.garden ? 'Sí' : 'No'}</dd>
						</div>
					</dl>
				</Card>

				<!-- Location -->
				<Card class="p-4">
					<h3 class="mb-3 font-semibold">Ubicación</h3>
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Dirección</dt>
							<dd class="font-medium text-right">{property.address}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Ciudad</dt>
							<dd class="font-medium">{property.city}</dd>
						</div>
						{#if property.postalCode}
							<div class="flex justify-between">
								<dt class="text-muted-foreground">C.P.</dt>
								<dd class="font-medium">{property.postalCode}</dd>
							</div>
						{/if}
						<div class="flex justify-between">
							<dt class="text-muted-foreground">País</dt>
							<dd class="font-medium">{property.country}</dd>
						</div>
					</dl>
				</Card>

				<!-- Metadata -->
				<Card class="p-4">
					<h3 class="mb-3 font-semibold">Información</h3>
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-muted-foreground">ID</dt>
							<dd class="font-medium">#{property.id}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Creado</dt>
							<dd class="font-medium">{formatDate(property.createdAt)}</dd>
						</div>
						{#if property.updatedAt}
							<div class="flex justify-between">
								<dt class="text-muted-foreground">Actualizado</dt>
								<dd class="font-medium">{formatDate(property.updatedAt)}</dd>
							</div>
						{/if}
					</dl>
				</Card>
			</div>
		</div>
	</div>

	<!-- Delete modal -->
	<Modal bind:open={deleteModal} title="Confirmar eliminación" size="sm">
		<p class="text-sm text-muted-foreground">¿Eliminar "{property.title}"? Esta acción no se puede deshacer.</p>
		<div class="mt-4 flex justify-end gap-2">
			<Button variant="outline" onclick={() => (deleteModal = false)}>Cancelar</Button>
			<Button variant="destructive" onclick={handleDelete}>Eliminar</Button>
		</div>
	</Modal>
{:else}
	<div class="flex h-64 flex-col items-center justify-center">
		<h2 class="text-xl font-semibold">Propiedad no encontrada</h2>
		<Button class="mt-4" onclick={() => goto('/properties')}>Volver a propiedades</Button>
	</div>
{/if}
