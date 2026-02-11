<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$stores/auth';
	import { toast } from '$stores/toast';
	import Button from '$ui/Button.svelte';
	import Input from '$ui/Input.svelte';

	let email = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!email.trim()) e.email = 'El email es obligatorio';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido';
		if (!password) e.password = 'La contraseña es obligatoria';
		else if (password.length < 6) e.password = 'Mínimo 6 caracteres';
		errors = e;
		return Object.keys(e).length === 0;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validate()) return;

		loading = true;
		const success = await auth.login(email, password);
		loading = false;

		if (success) {
			if (rememberMe && typeof localStorage !== 'undefined') {
				localStorage.setItem('rememberMe', 'true');
			}
			toast.success('Sesión iniciada correctamente');
			goto('/dashboard');
		} else {
			toast.error('Credenciales inválidas');
		}
	}
</script>

<svelte:head>
	<title>Iniciar Sesión | Inmobiliaria</title>
</svelte:head>

<div class="rounded-xl border bg-card p-6 shadow-sm">
	<h2 class="mb-6 text-lg font-semibold text-card-foreground">Iniciar Sesión</h2>

	<form onsubmit={handleSubmit} class="space-y-4">
		<div>
			<label for="email" class="mb-1.5 block text-sm font-medium text-foreground">Email</label>
			<Input
				type="email"
				id="email"
				name="email"
				placeholder="tu@email.com"
				bind:value={email}
				error={errors.email}
				required
			/>
		</div>

		<div>
			<label for="password" class="mb-1.5 block text-sm font-medium text-foreground">Contraseña</label>
			<Input
				type="password"
				id="password"
				name="password"
				placeholder="••••••••"
				bind:value={password}
				error={errors.password}
				required
			/>
		</div>

		<div class="flex items-center gap-2">
			<input
				type="checkbox"
				id="rememberMe"
				bind:checked={rememberMe}
				class="h-4 w-4 rounded border-input text-primary focus:ring-primary"
			/>
			<label for="rememberMe" class="text-sm text-muted-foreground">Recordarme</label>
		</div>

		<Button type="submit" class="w-full" {loading} disabled={loading}>
			{loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
		</Button>
	</form>
</div>
