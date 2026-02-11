<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatDateTime } from '$lib/utils';
	import type { Document } from '$types';
	import { sharingApi, type ShareLinkConfig, type ShareLink } from '$lib/stores/documents';
	import { toast } from '$lib/stores/toast';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	interface Props {
		document: Document;
		open?: boolean;
		onclose?: () => void;
	}

	let {
		document: doc,
		open = $bindable(false),
		onclose,
	}: Props = $props();

	// Form state
	let permission = $state<'view' | 'download' | 'edit'>('view');
	let expiresIn = $state('168'); // 7 days default
	let password = $state('');
	let maxDownloads = $state('');
	let recipientEmail = $state('');
	let recipientName = $state('');
	let message = $state('');
	let notifyOnAccess = $state(false);

	// Generated links
	let links = $state<ShareLink[]>([]);
	let isGenerating = $state(false);
	let copiedId = $state<number | null>(null);
	let showAdvanced = $state(false);

	const expiryOptions = [
		{ value: '1', label: '1 hora' },
		{ value: '24', label: '24 horas' },
		{ value: '168', label: '7 días' },
		{ value: '720', label: '30 días' },
		{ value: '2160', label: '90 días' },
		{ value: '', label: 'Sin expiración' },
	];

	const permissionOptions = [
		{ value: 'view', label: 'Solo ver' },
		{ value: 'download', label: 'Ver y descargar' },
		{ value: 'edit', label: 'Editar' },
	];

	async function generateLink() {
		isGenerating = true;
		try {
			const config: ShareLinkConfig = {
				permission,
				expiresIn: expiresIn ? Number(expiresIn) : null,
				notifyOnAccess,
			};
			if (password) config.password = password;
			if (maxDownloads) config.maxDownloads = Number(maxDownloads);
			if (recipientEmail) config.recipientEmail = recipientEmail;
			if (recipientName) config.recipientName = recipientName;
			if (message) config.message = message;

			const link = await sharingApi.createShareLink(doc.id, config);
			links = [link, ...links];
			toast.success('Enlace generado');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Error al generar enlace');
		} finally {
			isGenerating = false;
		}
	}

	async function copyLink(link: ShareLink) {
		try {
			await navigator.clipboard.writeText(link.url);
			copiedId = link.id;
			setTimeout(() => copiedId = null, 2000);
			toast.success('Enlace copiado');
		} catch {
			toast.error('No se pudo copiar');
		}
	}

	async function revokeLink(link: ShareLink) {
		try {
			await sharingApi.revokeShareLink(link.id);
			links = links.map(l => l.id === link.id ? { ...l, isActive: false } : l);
			toast.success('Enlace revocado');
		} catch {
			toast.error('Error al revocar enlace');
		}
	}

	// Load existing share links on open
	$effect(() => {
		if (open && doc?.id) {
			sharingApi.getShareLinks(doc.id).then(result => {
				links = result;
			}).catch(() => {
				links = [];
			});
		}
	});
</script>

<Modal bind:open title="Compartir Documento" size="lg" {onclose}>
	<div class="space-y-5">
		<!-- Document Info -->
		<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
			<div class="text-2xl">📄</div>
			<div class="min-w-0">
				<p class="truncate text-sm font-medium">{doc.originalFilename}</p>
				<p class="text-xs text-muted-foreground">{doc.mimeType}</p>
			</div>
		</div>

		<!-- Generate Link Form -->
		<div class="space-y-3">
			<h4 class="text-sm font-semibold">Generar nuevo enlace</h4>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-xs font-medium">Permiso</label>
					<Select options={permissionOptions} bind:value={permission} class="h-9 text-xs" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium">Expiración</label>
					<Select options={expiryOptions} bind:value={expiresIn} class="h-9 text-xs" />
				</div>
			</div>

			<!-- Advanced options toggle -->
			<button
				class="text-xs text-primary hover:underline"
				onclick={() => showAdvanced = !showAdvanced}
			>
				{showAdvanced ? '▼' : '▶'} Opciones avanzadas
			</button>

			{#if showAdvanced}
				<div class="space-y-3 rounded-lg border p-3">
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs font-medium">Contraseña (opcional)</label>
							<Input type="password" bind:value={password} placeholder="Sin contraseña" class="h-9 text-xs" />
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium">Máx. descargas</label>
							<Input type="number" bind:value={maxDownloads} placeholder="Ilimitado" class="h-9 text-xs" />
						</div>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs font-medium">Email destinatario</label>
							<Input type="email" bind:value={recipientEmail} placeholder="email@ejemplo.com" class="h-9 text-xs" />
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium">Nombre destinatario</label>
							<Input bind:value={recipientName} placeholder="Nombre" class="h-9 text-xs" />
						</div>
					</div>

					<div>
						<label class="mb-1 block text-xs font-medium">Mensaje</label>
						<textarea
							bind:value={message}
							placeholder="Mensaje opcional para el destinatario..."
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							rows="2"
						></textarea>
					</div>

					<label class="flex items-center gap-2 text-xs">
						<input type="checkbox" bind:checked={notifyOnAccess} class="rounded" />
						Notificar cuando se acceda al enlace
					</label>
				</div>
			{/if}

			<Button onclick={generateLink} loading={isGenerating} class="w-full" size="sm">
				<svg class="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
				</svg>
				Generar Enlace
			</Button>
		</div>

		<!-- Existing Links -->
		{#if links.length > 0}
			<div class="space-y-2">
				<h4 class="text-sm font-semibold">Enlaces existentes</h4>
				
				{#each links as link (link.id)}
					<div class={cn(
						'flex items-center gap-3 rounded-lg border p-3',
						!link.isActive && 'opacity-50'
					)}>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<code class="truncate text-xs text-muted-foreground">{link.url}</code>
								<Badge variant={link.isActive ? 'default' : 'secondary'} class="text-[10px]">
									{link.isActive ? link.permission : 'Revocado'}
								</Badge>
							</div>
							<div class="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
								<span>Creado: {formatDateTime(link.createdAt)}</span>
								{#if link.expiresAt}<span>Expira: {formatDateTime(link.expiresAt)}</span>{/if}
								<span>Descargas: {link.currentDownloads}{link.maxDownloads ? `/${link.maxDownloads}` : ''}</span>
							</div>
						</div>

						<div class="flex gap-1">
							{#if link.isActive}
								<Button variant="outline" size="sm" onclick={() => copyLink(link)}>
									{copiedId === link.id ? '✓ Copiado' : 'Copiar'}
								</Button>
								<Button variant="ghost" size="sm" onclick={() => revokeLink(link)}>
									Revocar
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Modal>
