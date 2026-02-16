<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth-simple';

	let status = $state('Procesando autenticación...');
	let isError = $state(false);

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const token = params.get('token');
		const refreshToken = params.get('refreshToken');
		const error = params.get('error');

		if (error) {
			isError = true;
			const errorMessages: Record<string, string> = {
				'google_access_denied': 'Acceso denegado. Has cancelado la autenticación con Google.',
				'missing_code': 'Error en el proceso de autenticación. Inténtalo de nuevo.',
				'google_auth_failed': 'Error al autenticar con Google. Inténtalo más tarde.',
			};
			status = errorMessages[error] || `Error de autenticación: ${error}`;
			setTimeout(() => goto('/auth/login'), 3000);
			return;
		}

		if (token && refreshToken) {
			status = 'Autenticando...';
			const success = await auth.loginWithTokens(token, refreshToken);
			
			if (success) {
				status = '¡Autenticado! Redirigiendo al dashboard...';
				// Small delay so user sees the success message
				setTimeout(() => goto('/dashboard'), 500);
			} else {
				isError = true;
				status = 'Error al procesar la autenticación. Redirigiendo...';
				setTimeout(() => goto('/auth/login'), 2000);
			}
		} else {
			isError = true;
			status = 'Faltan datos de autenticación. Redirigiendo al login...';
			setTimeout(() => goto('/auth/login'), 2000);
		}
	});
</script>

<svelte:head>
	<title>Autenticando... | Inmobiliaria</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
		{#if isError}
			<div class="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center mx-auto mb-4">
				<svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</div>
		{:else}
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
		{/if}
		<p class="text-gray-600">{status}</p>
	</div>
</div>
