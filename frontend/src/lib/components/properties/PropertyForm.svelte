<script lang="ts">
	import type { Property, PropertyInput } from '$types';
	import { PROPERTY_TYPES, PROPERTY_STATUSES } from '$types';
	import Input from '$ui/Input.svelte';
	import Select from '$ui/Select.svelte';
	import Button from '$ui/Button.svelte';

	interface Props {
		property?: Property | null;
		loading?: boolean;
		onsubmit: (data: PropertyInput) => void;
		oncancel: () => void;
	}

	let { property = null, loading = false, onsubmit, oncancel }: Props = $props();

	let title = $state(property?.title ?? '');
	let description = $state(property?.description ?? '');
	let address = $state(property?.address ?? '');
	let city = $state(property?.city ?? '');
	let postalCode = $state(property?.postalCode ?? '');
	let country = $state(property?.country ?? 'España');
	let propertyType = $state(property?.propertyType ?? 'apartment');
	let status = $state(property?.status ?? 'available');
	let price = $state(property?.price ?? '');
	let surfaceArea = $state(property?.surfaceArea?.toString() ?? '');
	let bedrooms = $state(property?.bedrooms?.toString() ?? '');
	let bathrooms = $state(property?.bathrooms?.toString() ?? '');
	let garage = $state(property?.garage ?? false);
	let garden = $state(property?.garden ?? false);

	let errors: Record<string, string> = $state({});

	function validate(): boolean {
		errors = {};
		if (!title.trim()) errors.title = 'Título obligatorio';
		if (!address.trim()) errors.address = 'Dirección obligatoria';
		if (!city.trim()) errors.city = 'Ciudad obligatoria';
		if (!price || Number(price) <= 0) errors.price = 'Precio debe ser mayor a 0';
		return Object.keys(errors).length === 0;
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validate()) return;

		const data: PropertyInput = {
			title: title.trim(),
			description: description.trim() || undefined,
			address: address.trim(),
			city: city.trim(),
			postalCode: postalCode.trim() || undefined,
			country: country.trim() || 'España',
			propertyType: propertyType as any,
			status: status as any,
			price: price,
			surfaceArea: surfaceArea ? Number(surfaceArea) : undefined,
			bedrooms: bedrooms ? Number(bedrooms) : undefined,
			bathrooms: bathrooms ? Number(bathrooms) : undefined,
			garage,
			garden
		};

		onsubmit(data);
	}

	const isEdit = $derived(!!property);
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- Basic Info -->
	<div>
		<h3 class="mb-3 text-lg font-semibold">Información básica</h3>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label for="title" class="mb-1 block text-sm font-medium">Título *</label>
				<Input id="title" bind:value={title} placeholder="Ej: Piso luminoso en el centro" error={errors.title} />
			</div>
			<div class="sm:col-span-2">
				<label for="description" class="mb-1 block text-sm font-medium">Descripción</label>
				<textarea
					id="description"
					bind:value={description}
					rows="3"
					placeholder="Descripción detallada de la propiedad..."
					class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>
			<div>
				<label for="propertyType" class="mb-1 block text-sm font-medium">Tipo</label>
				<Select id="propertyType" options={PROPERTY_TYPES} bind:value={propertyType} />
			</div>
			<div>
				<label for="status" class="mb-1 block text-sm font-medium">Estado</label>
				<Select id="status" options={PROPERTY_STATUSES.map((s) => ({ value: s.value, label: s.label }))} bind:value={status} />
			</div>
			<div>
				<label for="price" class="mb-1 block text-sm font-medium">Precio (€) *</label>
				<Input id="price" type="number" bind:value={price} placeholder="150000" error={errors.price} />
			</div>
		</div>
	</div>

	<!-- Location -->
	<div>
		<h3 class="mb-3 text-lg font-semibold">Ubicación</h3>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label for="address" class="mb-1 block text-sm font-medium">Dirección *</label>
				<Input id="address" bind:value={address} placeholder="Calle, número, piso..." error={errors.address} />
			</div>
			<div>
				<label for="city" class="mb-1 block text-sm font-medium">Ciudad *</label>
				<Input id="city" bind:value={city} placeholder="Madrid" error={errors.city} />
			</div>
			<div>
				<label for="postalCode" class="mb-1 block text-sm font-medium">Código postal</label>
				<Input id="postalCode" bind:value={postalCode} placeholder="28001" />
			</div>
			<div>
				<label for="country" class="mb-1 block text-sm font-medium">País</label>
				<Input id="country" bind:value={country} placeholder="España" />
			</div>
		</div>
	</div>

	<!-- Features -->
	<div>
		<h3 class="mb-3 text-lg font-semibold">Características</h3>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			<div>
				<label for="surfaceArea" class="mb-1 block text-sm font-medium">Superficie (m²)</label>
				<Input id="surfaceArea" type="number" bind:value={surfaceArea} placeholder="80" />
			</div>
			<div>
				<label for="bedrooms" class="mb-1 block text-sm font-medium">Habitaciones</label>
				<Input id="bedrooms" type="number" bind:value={bedrooms} placeholder="3" />
			</div>
			<div>
				<label for="bathrooms" class="mb-1 block text-sm font-medium">Baños</label>
				<Input id="bathrooms" type="number" bind:value={bathrooms} placeholder="2" />
			</div>
		</div>
		<div class="mt-4 flex gap-6">
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={garage} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
				Garaje
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={garden} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
				Jardín
			</label>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex justify-end gap-3 border-t pt-4">
		<Button variant="outline" onclick={oncancel} disabled={loading}>Cancelar</Button>
		<Button type="submit" {loading}>{isEdit ? 'Actualizar' : 'Crear'} propiedad</Button>
	</div>
</form>
