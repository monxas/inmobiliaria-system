<script lang="ts">
	import { toast, type Toast } from '$stores/toast';
	import { cn } from '$lib/utils';

	const toastStyles = {
		success: 'bg-green-100 border-green-500 text-green-800',
		error: 'bg-red-100 border-red-500 text-red-800',
		warning: 'bg-yellow-100 border-yellow-500 text-yellow-800',
		info: 'bg-blue-100 border-blue-500 text-blue-800'
	};

	let toasts: Toast[] = $state([]);

	toast.subscribe((value) => {
		toasts = value;
	});
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
	{#each toasts as t (t.id)}
		<div
			class={cn(
				'flex items-center gap-2 rounded-lg border-l-4 px-4 py-3 shadow-lg',
				toastStyles[t.type]
			)}
		>
			<span class="flex-1">{t.message}</span>
			<button
				onclick={() => toast.remove(t.id)}
				class="text-current opacity-70 hover:opacity-100"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>
