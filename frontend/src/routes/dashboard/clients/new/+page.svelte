<script lang="ts">
	import { goto } from '$app/navigation';
	import { clients } from '$stores/clients';
	import ClientForm from '$lib/components/forms/ClientForm.svelte';
	import type { ClientInput } from '$types';

	let saving = $state(false);

	async function handleSubmit(data: ClientInput) {
		saving = true;
		const result = await clients.createClient(data);
		saving = false;
		if (result) {
			goto(`/dashboard/clients/${result.id}`);
		}
	}

	function handleCancel() {
		goto('/dashboard/clients');
	}
</script>

<svelte:head>
	<title>Nuevo Cliente | Inmobiliaria</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<button class="mb-2 text-sm text-muted-foreground hover:text-foreground" onclick={handleCancel}>
			← Volver a clientes
		</button>
		<h1 class="text-2xl font-bold tracking-tight">Nuevo Cliente</h1>
		<p class="text-muted-foreground">Añade un nuevo cliente a tu cartera</p>
	</div>

	<ClientForm onsubmit={handleSubmit} oncancel={handleCancel} {saving} />
</div>
