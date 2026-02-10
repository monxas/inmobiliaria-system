<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		variant?: 'default' | 'secondary' | 'destructive' | 'outline';
		class?: string;
	}

	let {
		variant = 'default',
		class: className = '',
		...restProps
	}: Props & Record<string, unknown> = $props();

	const variants = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/80',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
		outline: 'text-foreground border'
	};
</script>

<div
	class={cn(
		'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
		variants[variant],
		className
	)}
	{...restProps}
>
	<slot />
</div>
