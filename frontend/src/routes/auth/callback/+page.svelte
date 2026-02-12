<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth-simple';

	let status = $state('Procesando autenticación...');

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const token = params.get('token');
		const refreshToken = params.get('refreshToken');
		const error = params.get('error');

		if (error) {
			status = `Error de autenticación: ${error}`;
			setTimeout(() => goto('/auth/login'), 3000);
			return;
		}

		if (token && refreshToken) {
			// Store tokens
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('accessToken', token);
				localStorage.setItem('refreshToken', refreshToken);
			}

			// Update auth store - set as authenticated
			// The auth-simple store uses a mock user, but we set the tokens
			// so the real API client can use them
			auth.login('google-oauth', 'google-oauth').then(() => {
				status = '¡Autenticado! Redirigiendo...';
				goto('/dashboard');
			});
		} else {
			status = 'Faltan tokens. Redirigiendo al login...';
			setTimeout(() => goto('/auth/login'), 2000);
		}
	});
</script>

<svelte:head>
	<title>Autenticando... | Inmobiliaria</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
		<p class="text-gray-600">{status}</p>
	</div>
</div>
