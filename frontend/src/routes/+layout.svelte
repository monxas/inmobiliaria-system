<script lang="ts">
	import '../app.css';
	import { auth } from '$lib/stores/auth-simple';
	import { onMount } from 'svelte';

	console.log('🔧 Layout script loaded');

	let { children } = $props();

	onMount(() => {
		console.log('🔧 Layout onMount called');
		try {
			console.log('🔧 Calling auth.initialize()');
			auth.initialize();
			console.log('🔧 auth.initialize() completed');
		} catch (error) {
			console.error('💥 Error in auth.initialize():', error);
		}
	});
</script>

{@render children()}
