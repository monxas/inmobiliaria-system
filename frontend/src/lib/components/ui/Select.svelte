<script lang="ts">
	import { cn } from '$lib/utils';

	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		options: Option[];
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		id?: string;
		name?: string;
		class?: string;
		error?: string;
		onchange?: (e: Event) => void;
	}

	let {
		options,
		value = $bindable(''),
		placeholder = 'Seleccionar...',
		disabled = false,
		required = false,
		id,
		name,
		class: className = '',
		error,
		onchange,
		...restProps
	}: Props & Record<string, unknown> = $props();
</script>

<select
	bind:value
	{disabled}
	{required}
	{id}
	{name}
	onchange={onchange}
	class={cn(
		'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
		error && 'border-destructive focus-visible:ring-destructive',
		className
	)}
	{...restProps}
>
	{#if placeholder}
		<option value="" disabled>{placeholder}</option>
	{/if}
	{#each options as option}
		<option value={option.value}>{option.label}</option>
	{/each}
</select>

{#if error}
	<p class="mt-1 text-sm text-destructive">{error}</p>
{/if}
