<script lang="ts">
	import { user } from '$stores/auth';
	import { toast } from '$stores/toast';
	import { authApi } from '$api/client';
	import Button from '$ui/Button.svelte';
	import Input from '$ui/Input.svelte';

	let fullName = $state($user?.fullName ?? '');
	let phone = $state($user?.phone ?? '');
	let loading = $state(false);

	$effect(() => {
		if ($user) {
			fullName = $user.fullName;
			phone = $user.phone ?? '';
		}
	});

	async function handleSave(e: Event) {
		e.preventDefault();
		loading = true;
		try {
			await authApi.updateProfile({ fullName, phone });
			toast.success('Perfil actualizado');
		} catch {
			toast.error('Error al actualizar perfil');
		}
		loading = false;
	}
</script>

<svelte:head><title>Perfil | Inmobiliaria</title></svelte:head>

<div class="max-w-lg">
	<h1 class="text-2xl font-bold">Mi Perfil</h1>
	<p class="mt-1 text-muted-foreground">Gestiona tu información personal.</p>

	<form onsubmit={handleSave} class="mt-6 space-y-4">
		<div>
			<label for="email" class="mb-1.5 block text-sm font-medium">Email</label>
			<Input id="email" value={$user?.email ?? ''} disabled />
		</div>
		<div>
			<label for="fullName" class="mb-1.5 block text-sm font-medium">Nombre</label>
			<Input id="fullName" bind:value={fullName} />
		</div>
		<div>
			<label for="phone" class="mb-1.5 block text-sm font-medium">Teléfono</label>
			<Input id="phone" type="tel" bind:value={phone} />
		</div>
		<div>
			<label class="mb-1.5 block text-sm font-medium">Rol</label>
			<Input value={$user?.role ?? ''} disabled />
		</div>
		<Button type="submit" {loading}>Guardar Cambios</Button>
	</form>
</div>
