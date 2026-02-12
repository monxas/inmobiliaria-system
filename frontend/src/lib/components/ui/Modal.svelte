<script lang="ts">
	import { cn } from '$lib/utils';
	import Button from './Button.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		class?: string;
		onclose?: () => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title = '',
		size = 'md',
		class: className = '',
		onclose,
		children
	}: Props = $props();

	const sizes = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl'
	};

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			open = false;
			onclose?.();
		}
	}

	function handleClose() {
		open = false;
		onclose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
	>
		<div class={cn('w-full rounded-lg bg-background p-6 shadow-lg', sizes[size], className)}>
			{#if title}
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-lg font-semibold">{title}</h2>
					<Button variant="ghost" size="icon" onclick={handleClose}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</Button>
				</div>
			{/if}
			{@render children?.()}
		</div>
	</div>
{/if}
