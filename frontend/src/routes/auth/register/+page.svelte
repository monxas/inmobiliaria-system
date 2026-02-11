<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth, isAdmin } from '$stores/auth';
	import { toast } from '$stores/toast';
	import Button from '$ui/Button.svelte';
	import Input from '$ui/Input.svelte';
	import type { UserRole } from '$types';
	import { USER_ROLES } from '$types';

	let fullName = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let role = $state<UserRole>('agent');
	let phone = $state('');
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!fullName.trim()) e.fullName = 'El nombre es obligatorio';
		if (!email.trim()) e.email = 'El email es obligatorio';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido';
		if (!password) e.password = 'La contraseña es obligatoria';
		else if (password.length < 8) e.password = 'Mínimo 8 caracteres';
		if (password !== confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validate()) return;

		loading = true;
		const success = await auth.register(email, password, fullName);
		loading = false;

		if (success) {
			toast.success('Usuario registrado correctamente');
			goto('/dashboard');
		} else {
			toast.error('Error al registrar usuario');
		}
	}
</script>

<svelte:head>
	<title>Registrar Usuario | Inmobiliaria</title>
</svelte:head>

<div class="rounded-xl border bg-card p-6 shadow-sm">
	<h2 class="mb-6 text-lg font-semibold text-card-foreground">Registrar Nuevo Usuario</h2>

	<form onsubmit={handleSubmit} class="space-y-4">
		<div>
			<label for="fullName" class="mb-1.5 block text-sm font-medium">Nombre Completo</label>
			<Input id="fullName" name="fullName" placeholder="Juan García" bind:value={fullName} error={errors.fullName} required />
		</div>

		<div>
			<label for="email" class="mb-1.5 block text-sm font-medium">Email</label>
			<Input type="email" id="email" name="email" placeholder="juan@email.com" bind:value={email} error={errors.email} required />
		</div>

		<div>
			<label for="role" class="mb-1.5 block text-sm font-medium">Rol</label>
			<select
				id="role"
				bind:value={role}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{#each USER_ROLES as r}
					<option value={r.value}>{r.label}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="phone" class="mb-1.5 block text-sm font-medium">Teléfono (opcional)</label>
			<Input type="tel" id="phone" name="phone" placeholder="+34 600 000 000" bind:value={phone} />
		</div>

		<div>
			<label for="password" class="mb-1.5 block text-sm font-medium">Contraseña</label>
			<Input type="password" id="password" name="password" placeholder="••••••••" bind:value={password} error={errors.password} required />
		</div>

		<div>
			<label for="confirmPassword" class="mb-1.5 block text-sm font-medium">Confirmar Contraseña</label>
			<Input type="password" id="confirmPassword" name="confirmPassword" placeholder="••••••••" bind:value={confirmPassword} error={errors.confirmPassword} required />
		</div>

		<Button type="submit" class="w-full" {loading} disabled={loading}>
			{loading ? 'Registrando...' : 'Registrar Usuario'}
		</Button>
	</form>

	<p class="mt-4 text-center text-sm text-muted-foreground">
		<a href="/auth/login" class="text-primary hover:underline">Volver al inicio de sesión</a>
	</p>
</div>
