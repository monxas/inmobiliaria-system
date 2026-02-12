<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth-simple';

	let email = $state('admin@test.com');
	let password = $state('test');
	let loading = $state(false);
	let error = $state('');

	async function handleLogin() {
		if (loading) return;
		
		loading = true;
		error = '';
		
		try {
			const success = await auth.login(email, password);
			if (success) {
				goto('/dashboard');
			} else {
				error = 'Credenciales incorrectas';
			}
		} catch (err: any) {
			error = 'Error de conexión: ' + (err?.message || 'unknown');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Iniciar Sesión | Inmobiliaria</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="max-w-md w-full bg-white rounded-lg shadow-md p-6">
		<h2 class="text-2xl font-bold text-center mb-6">Iniciar Sesión</h2>
		
		{#if error}
			<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
				{error}
			</div>
		{/if}
		
		<div class="space-y-4">
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
				/>
			</div>

			<button
				onclick={handleLogin}
				disabled={loading}
				class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
			>
				{loading ? 'Cargando...' : 'Iniciar Sesión'}
			</button>

			<div class="text-center text-sm text-gray-600">
				<p>Credenciales de prueba:</p>
				<p>Email: <code>admin@test.com</code></p>
				<p>Password: <code>test</code></p>
			</div>
		</div>
	</div>
</div>
