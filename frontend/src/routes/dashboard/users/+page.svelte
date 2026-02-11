<script lang="ts">
	import { isAdmin } from '$stores/auth';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	$effect(() => {
		if (browser && !$isAdmin) goto('/dashboard');
	});
</script>

<svelte:head><title>Usuarios | Inmobiliaria</title></svelte:head>
<div>
	<h1 class="text-2xl font-bold">Usuarios</h1>
	<p class="mt-1 text-muted-foreground">Gestión de usuarios y roles (solo administradores).</p>
</div>
