<script lang="ts">
	import type { Property } from '$types';
	import { PROPERTY_STATUSES, PROPERTY_TYPES } from '$types';
	import { formatCurrency, formatDate } from '$lib/utils';
	import Badge from '$ui/Badge.svelte';
	import Button from '$ui/Button.svelte';

	interface Props {
		items: Property[];
		selectedIds: Set<number>;
		onselect: (id: number) => void;
		onselectall: () => void;
		onview: (id: number) => void;
		onedit: (id: number) => void;
		ondelete: (id: number) => void;
	}

	let { items, selectedIds, onselect, onselectall, onview, onedit, ondelete }: Props = $props();

	const allSelected = $derived(items.length > 0 && items.every((p) => selectedIds.has(p.id)));

	function getStatusBadge(status: string) {
		return PROPERTY_STATUSES.find((s) => s.value === status);
	}

	function getTypeLabel(type: string) {
		return PROPERTY_TYPES.find((t) => t.value === type)?.label ?? type;
	}
</script>

<div class="overflow-auto rounded-lg border">
	<table class="w-full text-sm">
		<thead class="border-b bg-muted/50">
			<tr>
				<th class="w-10 px-3 py-3">
					<input
						type="checkbox"
						checked={allSelected}
						onchange={onselectall}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
					/>
				</th>
				<th class="px-3 py-3 text-left font-medium">Propiedad</th>
				<th class="px-3 py-3 text-left font-medium">Tipo</th>
				<th class="px-3 py-3 text-left font-medium">Ciudad</th>
				<th class="px-3 py-3 text-right font-medium">Precio</th>
				<th class="px-3 py-3 text-center font-medium">Estado</th>
				<th class="px-3 py-3 text-center font-medium">Hab.</th>
				<th class="px-3 py-3 text-center font-medium">m²</th>
				<th class="px-3 py-3 text-right font-medium">Acciones</th>
			</tr>
		</thead>
		<tbody>
			{#each items as property (property.id)}
				{@const statusInfo = getStatusBadge(property.status)}
				<tr class="border-b transition-colors hover:bg-muted/30 {selectedIds.has(property.id) ? 'bg-primary/5' : ''}">
					<td class="px-3 py-3">
						<input
							type="checkbox"
							checked={selectedIds.has(property.id)}
							onchange={() => onselect(property.id)}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
						/>
					</td>
					<td class="px-3 py-3">
						<button onclick={() => onview(property.id)} class="text-left hover:underline">
							<div class="font-medium">{property.title}</div>
							<div class="text-xs text-muted-foreground">{property.address}</div>
						</button>
					</td>
					<td class="px-3 py-3 text-muted-foreground">{getTypeLabel(property.propertyType)}</td>
					<td class="px-3 py-3">{property.city}</td>
					<td class="px-3 py-3 text-right font-semibold">{formatCurrency(property.price)}</td>
					<td class="px-3 py-3 text-center">
						{#if statusInfo}
							<Badge class={statusInfo.color}>{statusInfo.label}</Badge>
						{/if}
					</td>
					<td class="px-3 py-3 text-center">{property.bedrooms ?? '-'}</td>
					<td class="px-3 py-3 text-center">{property.surfaceArea ?? '-'}</td>
					<td class="px-3 py-3">
						<div class="flex justify-end gap-1">
							<Button variant="ghost" size="icon" onclick={() => onedit(property.id)} title="Editar">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
							</Button>
							<Button variant="ghost" size="icon" onclick={() => ondelete(property.id)} title="Eliminar">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
							</Button>
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="9" class="px-3 py-8 text-center text-muted-foreground">
						No se encontraron propiedades
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
