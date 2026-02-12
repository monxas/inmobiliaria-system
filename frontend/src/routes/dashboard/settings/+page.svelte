<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { calendarStore } from '$stores/calendar';
	import { Calendar, Check, X, Unplug } from 'lucide-svelte';

	let calendarMessage = $state('');
	let calendarMessageType = $state<'success' | 'error'>('success');

	onMount(() => {
		calendarStore.checkStatus();

		// Check URL params for OAuth callback results
		const params = new URLSearchParams(window.location.search);
		if (params.get('calendar_connected') === 'true') {
			calendarMessage = '¡Google Calendar conectado correctamente!';
			calendarMessageType = 'success';
			calendarStore.checkStatus();
			// Clean URL
			window.history.replaceState({}, '', window.location.pathname);
		}
		if (params.get('calendar_error')) {
			calendarMessage = `Error al conectar Google Calendar: ${params.get('calendar_error')}`;
			calendarMessageType = 'error';
			window.history.replaceState({}, '', window.location.pathname);
		}
	});
</script>

<svelte:head><title>Configuración | Inmobiliaria</title></svelte:head>

<div class="max-w-lg">
	<h1 class="text-2xl font-bold">Configuración</h1>
	<p class="mt-1 text-muted-foreground">Ajustes de la aplicación.</p>

	<div class="mt-6 space-y-6">
		<!-- Google Calendar Integration -->
		<div class="rounded-xl border bg-card p-4">
			<div class="flex items-center gap-2 mb-3">
				<Calendar class="h-5 w-5 text-primary" />
				<h3 class="font-medium">Google Calendar</h3>
			</div>

			{#if calendarMessage}
				<div class="mb-3 rounded-md p-3 text-sm flex items-center gap-2
					{calendarMessageType === 'success' ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'}">
					{#if calendarMessageType === 'success'}
						<Check class="h-4 w-4" />
					{:else}
						<X class="h-4 w-4" />
					{/if}
					{calendarMessage}
				</div>
			{/if}

			{#if $calendarStore.connected}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
							<Check class="h-4 w-4" />
							Conectado
						</p>
						{#if $calendarStore.email}
							<p class="text-xs text-muted-foreground mt-0.5">{$calendarStore.email}</p>
						{/if}
					</div>
					<button
						onclick={() => calendarStore.disconnect()}
						class="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
					>
						<Unplug class="h-4 w-4" />
						Desconectar
					</button>
				</div>
				<p class="mt-2 text-xs text-muted-foreground">
					Las citas creadas en el dashboard aparecerán en tu Google Calendar y viceversa.
				</p>
			{:else}
				<p class="text-sm text-muted-foreground mb-3">
					Conecta tu cuenta de Google para sincronizar citas y visitas de propiedades con Google Calendar.
				</p>
				<button
					onclick={() => calendarStore.connect()}
					class="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					<Calendar class="h-4 w-4" />
					Conectar Google Calendar
				</button>
			{/if}
		</div>

		<div class="rounded-xl border bg-card p-4">
			<h3 class="font-medium">Tema</h3>
			<p class="mt-1 text-sm text-muted-foreground">Próximamente: modo oscuro.</p>
		</div>
		<div class="rounded-xl border bg-card p-4">
			<h3 class="font-medium">Notificaciones</h3>
			<p class="mt-1 text-sm text-muted-foreground">Próximamente: preferencias de notificación.</p>
		</div>
	</div>
</div>
