<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth-simple';
	import { API_BASE } from '$lib/config';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let googleLoading = $state(false);
	let error = $state('');

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const urlError = params.get('error');
		if (urlError) {
			const errorMessages: Record<string, string> = {
				'google_access_denied': 'Has cancelado la autenticación con Google.',
				'missing_code': 'Error en la autenticación. Inténtalo de nuevo.',
				'google_auth_failed': 'Error al autenticar con Google. Inténtalo más tarde.',
			};
			error = errorMessages[urlError] || `Error de autenticación: ${urlError}`;
			// Clean URL
			window.history.replaceState({}, '', window.location.pathname);
		}
	});

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

	function handleGoogleLogin() {
		googleLoading = true;
		// Redirect to backend Google OAuth endpoint
		window.location.href = `${API_BASE}/auth/google`;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleLogin();
	}
</script>

<svelte:head>
	<title>Iniciar Sesión | Inmobiliaria</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="max-w-md w-full bg-white rounded-lg shadow-md p-6">
		<div class="text-center mb-6">
			<h2 class="text-2xl font-bold text-gray-900">Iniciar Sesión</h2>
			<p class="mt-1 text-sm text-gray-500">Accede a tu panel de gestión inmobiliaria</p>
		</div>
		
		{#if error}
			<div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
				<svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
				</svg>
				{error}
			</div>
		{/if}
		
		<!-- Google Login Button (Primary CTA) -->
		<button
			onclick={handleGoogleLogin}
			disabled={googleLoading}
			class="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-[#dadce0] rounded-lg text-sm font-medium text-[#3c4043] bg-white hover:bg-[#f8f9fa] active:bg-[#e8eaed] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#4285f4] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
		>
			{#if googleLoading}
				<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-[#4285f4]"></div>
				Redirigiendo a Google...
			{:else}
				<svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
				</svg>
				Iniciar sesión con Google
			{/if}
		</button>

		<!-- Divider -->
		<div class="relative my-5">
			<div class="absolute inset-0 flex items-center">
				<div class="w-full border-t border-gray-200"></div>
			</div>
			<div class="relative flex justify-center text-xs">
				<span class="px-3 bg-white text-gray-400 uppercase tracking-wider">o con email</span>
			</div>
		</div>

		<!-- Email/Password Form -->
		<div class="space-y-4">
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					onkeydown={handleKeydown}
					placeholder="tu@email.com"
					class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					onkeydown={handleKeydown}
					placeholder="••••••••"
					class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
				/>
			</div>

			<button
				onclick={handleLogin}
				disabled={loading || !email || !password}
				class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
			</button>
		</div>

		<p class="mt-4 text-center text-xs text-gray-400">
			¿No tienes cuenta? <a href="/auth/register" class="text-indigo-600 hover:text-indigo-500">Regístrate</a>
		</p>
	</div>
</div>
