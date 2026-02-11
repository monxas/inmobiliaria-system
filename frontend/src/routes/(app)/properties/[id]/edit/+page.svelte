<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { properties } from '$stores/properties';
	import PropertyForm from '$lib/components/properties/PropertyForm.svelte';
	import Card from '$ui/Card.svelte';
	import Button from '$ui/Button.svelte';

	const id = $derived(Number($page.params.id));
	let loading = $state(false);

	onMount(() => {
		properties.fetchOne(id);
	});

	const property = $derived($properties.selected);

	async function handleSubmit(data: any) {
		loading = true;
		try {
			await properties.update(id, data);
			goto(`/properties/${id}`);
		} catch {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Editar {property?.title ?? 'propiedad'} | Inmobiliaria</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<div class="flex items-center gap-2">
		<Button variant="ghost" size="sm" onclick={() => goto(`/properties/${id}`)}>
			<svg xmlns="http://www.w3.org/2000/svg" class="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
			Volver
		</Button>
	</div>

	<div>
		<h1 class="text-2xl font-bold">Editar propiedad</h1>
		<p class="text-sm text-muted-foreground">Modifica los datos de la propiedad</p>
	</div>

	{#if $properties.loading && !property}
		<div class="flex h-32 items-center justify-center">
			<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
		</div>
	{:else if property}
		<Card class="p-6">
			<PropertyForm {property} {loading} onsubmit={handleSubmit} oncancel={() => goto(`/properties/${id}`)} />
		</Card>
	{:else}
		<div class="text-center">
			<p>Propiedad no encontrada</p>
			<Button class="mt-4" onclick={() => goto('/properties')}>Volver</Button>
		</div>
	{/if}
</div>
