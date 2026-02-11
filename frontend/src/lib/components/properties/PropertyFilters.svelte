<script lang="ts">
	import type { PropertyFilters as Filters } from '$types';
	import { PROPERTY_TYPES, PROPERTY_STATUSES } from '$types';
	import Input from '$ui/Input.svelte';
	import Select from '$ui/Select.svelte';
	import Button from '$ui/Button.svelte';
	import { debounce } from '$lib/utils';

	interface Props {
		filters: Filters;
		onchange: (filters: Filters) => void;
	}

	let { filters, onchange }: Props = $props();

	let search = $state(filters.search ?? '');
	let city = $state(filters.city ?? '');
	let propertyType = $state(filters.propertyType ?? '');
	let status = $state(filters.status ?? '');
	let minPrice = $state(filters.minPrice?.toString() ?? '');
	let maxPrice = $state(filters.maxPrice?.toString() ?? '');
	let minBedrooms = $state(filters.minBedrooms?.toString() ?? '');
	let expanded = $state(false);

	const debouncedSearch = debounce((value: string) => {
		applyFilters();
	}, 300);

	function applyFilters() {
		const f: Filters = {};
		if (search) f.search = search;
		if (city) f.city = city;
		if (propertyType) f.propertyType = propertyType as any;
		if (status) f.status = status as any;
		if (minPrice) f.minPrice = Number(minPrice);
		if (maxPrice) f.maxPrice = Number(maxPrice);
		if (minBedrooms) f.minBedrooms = Number(minBedrooms);
		onchange(f);
	}

	function clearFilters() {
		search = '';
		city = '';
		propertyType = '';
		status = '';
		minPrice = '';
		maxPrice = '';
		minBedrooms = '';
		onchange({});
	}

	const hasFilters = $derived(
		!!(search || city || propertyType || status || minPrice || maxPrice || minBedrooms)
	);
</script>

<div class="space-y-4 rounded-lg border bg-card p-4">
	<!-- Search bar -->
	<div class="flex gap-3">
		<div class="flex-1">
			<Input
				placeholder="Buscar propiedades..."
				bind:value={search}
				oninput={() => debouncedSearch(search)}
			/>
		</div>
		<Button variant="outline" onclick={() => (expanded = !expanded)}>
			<svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
			</svg>
			Filtros
			{#if hasFilters}
				<span class="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">!</span>
			{/if}
		</Button>
		{#if hasFilters}
			<Button variant="ghost" onclick={clearFilters}>Limpiar</Button>
		{/if}
	</div>

	<!-- Expanded filters -->
	{#if expanded}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<label class="mb-1 block text-sm font-medium">Ciudad</label>
				<Input bind:value={city} placeholder="Ciudad..." oninput={() => debouncedSearch(city)} />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium">Tipo</label>
				<Select
					options={[{ value: '', label: 'Todos' }, ...PROPERTY_TYPES]}
					bind:value={propertyType}
					onchange={applyFilters}
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium">Estado</label>
				<Select
					options={[{ value: '', label: 'Todos' }, ...PROPERTY_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
					bind:value={status}
					onchange={applyFilters}
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium">Habitaciones mín.</label>
				<Input type="number" bind:value={minBedrooms} placeholder="0" oninput={() => debouncedSearch(minBedrooms)} />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium">Precio mínimo</label>
				<Input type="number" bind:value={minPrice} placeholder="0 €" oninput={() => debouncedSearch(minPrice)} />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium">Precio máximo</label>
				<Input type="number" bind:value={maxPrice} placeholder="Sin límite" oninput={() => debouncedSearch(maxPrice)} />
			</div>
		</div>
		<div class="flex justify-end">
			<Button size="sm" onclick={applyFilters}>Aplicar filtros</Button>
		</div>
	{/if}
</div>
