<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated, isLoading } from '$lib/stores/auth-simple';

	onMount(() => {
		const unsub = isLoading.subscribe(loading => {
			if (!loading) {
				const authUnsub = isAuthenticated.subscribe(auth => {
					if (auth) {
						goto('/dashboard');
					} else {
						goto('/auth/login');
					}
					authUnsub();
				});
				unsub();
			}
		});
	});
</script>

<div class="flex items-center justify-center h-screen">
	<div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
</div>
