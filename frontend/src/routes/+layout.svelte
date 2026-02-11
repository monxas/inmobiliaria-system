<script lang="ts">
	import '../app.css';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		auth.initialize();
	});
</script>

{@render children()}
