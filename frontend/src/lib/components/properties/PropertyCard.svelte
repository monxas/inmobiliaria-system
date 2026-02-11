<script lang="ts">
	import type { Property } from '$types';
	import { PROPERTY_STATUSES, PROPERTY_TYPES } from '$types';
	import { formatCurrency } from '$lib/utils';
	import Badge from '$ui/Badge.svelte';
	import Button from '$ui/Button.svelte';

	interface Props {
		property: Property;
		selected?: boolean;
		onselect?: (id: number) => void;
		onview?: (id: number) => void;
		onedit?: (id: number) => void;
		ondelete?: (id: number) => void;
	}

	let { property, selected = false, onselect, onview, onedit, ondelete }: Props = $props();

	const statusInfo = $derived(PROPERTY_STATUSES.find((s) => s.value === property.status));
	const typeInfo = $derived(PROPERTY_TYPES.find((t) => t.value === property.propertyType));
</script>

<div
	class="group relative rounded-lg border bg-card shadow-sm transition-all hover:shadow-md {selected
		? 'ring-2 ring-primary'
		: ''}"
>
	{#if onselect}
		<div class="absolute left-3 top-3 z-10">
			<input
				type="checkbox"
				checked={selected}
				onchange={() => onselect?.(property.id)}
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
			/>
		</div>
	{/if}

	<!-- Image placeholder -->
	<div class="relative h-48 overflow-hidden rounded-t-lg bg-muted">
		<div class="flex h-full items-center justify-center text-muted-foreground">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
			</svg>
		</div>
		{#if statusInfo}
			<div class="absolute right-2 top-2">
				<Badge class={statusInfo.color}>{statusInfo.label}</Badge>
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="p-4">
		<div class="mb-1 text-xs text-muted-foreground">{typeInfo?.label ?? property.propertyType}</div>
		<h3 class="mb-1 truncate text-lg font-semibold">{property.title}</h3>
		<p class="mb-2 truncate text-sm text-muted-foreground">
			{property.address}, {property.city}
		</p>

		<div class="mb-3 text-xl font-bold text-primary">
			{formatCurrency(property.price)}
		</div>

		<!-- Features -->
		<div class="mb-3 flex gap-3 text-sm text-muted-foreground">
			{#if property.bedrooms}
				<span class="flex items-center gap-1">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
					{property.bedrooms} hab.
				</span>
			{/if}
			{#if property.bathrooms}
				<span class="flex items-center gap-1">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
					{property.bathrooms} baños
				</span>
			{/if}
			{#if property.surfaceArea}
				<span>{property.surfaceArea} m²</span>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
			<Button variant="outline" size="sm" onclick={() => onview?.(property.id)}>Ver</Button>
			<Button variant="outline" size="sm" onclick={() => onedit?.(property.id)}>Editar</Button>
			<Button variant="destructive" size="sm" onclick={() => ondelete?.(property.id)}>Eliminar</Button>
		</div>
	</div>
</div>
