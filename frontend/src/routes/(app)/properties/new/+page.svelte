<script lang="ts">
	import { goto } from '$app/navigation';
	import { properties } from '$stores/properties';
	import PropertyForm from '$lib/components/properties/PropertyForm.svelte';
	import Card from '$ui/Card.svelte';

	let loading = $state(false);

	async function handleSubmit(data: any) {
		loading = true;
		try {
			await properties.create(data);
			goto('/properties');
		} catch {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Nueva propiedad | Inmobiliaria</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Nueva propiedad</h1>
		<p class="text-sm text-muted-foreground">Completa los datos para registrar una nueva propiedad</p>
	</div>

	<Card class="p-6">
		<PropertyForm {loading} onsubmit={handleSubmit} oncancel={() => goto('/properties')} />
	</Card>
</div>
