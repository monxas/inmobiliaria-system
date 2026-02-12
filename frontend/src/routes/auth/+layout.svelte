<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { isAuthenticated, isLoading } from '$stores/auth-simple';

	let { children } = $props();

	$effect(() => {
		if (browser && !$isLoading && $isAuthenticated) {
			goto('/dashboard');
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-muted/30 px-4">
	<div class="w-full max-w-md">
		<div class="mb-8 text-center">
			<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-foreground">Inmobiliaria</h1>
			<p class="mt-1 text-sm text-muted-foreground">Sistema de Gestión Inmobiliaria</p>
		</div>
		{@render children()}
	</div>
</div>
