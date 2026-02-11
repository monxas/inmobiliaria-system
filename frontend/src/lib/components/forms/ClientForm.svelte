<script lang="ts">
	import type { Client, ClientInput } from '$types';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	interface Props {
		initialData?: Client | null;
		saving?: boolean;
		onsubmit: (data: ClientInput) => void;
		oncancel: () => void;
	}

	let { initialData = null, saving = false, onsubmit, oncancel }: Props = $props();

	let fullName = $state(initialData?.fullName || '');
	let email = $state(initialData?.email || '');
	let phone = $state(initialData?.phone || '');
	let address = $state(initialData?.address || '');
	let notes = $state('');
	let agentId = $state(initialData?.agentId?.toString() || '');

	// Parse notes - handle JSON format from contact history
	$effect(() => {
		if (initialData?.notes) {
			try {
				const parsed = JSON.parse(initialData.notes);
				notes = parsed.text || '';
			} catch {
				notes = initialData.notes;
			}
		}
	});

	let errors = $state<Record<string, string>>({});

	function validate(): boolean {
		errors = {};
		if (!fullName.trim()) errors.fullName = 'El nombre es obligatorio';
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email no válido';
		if (phone && !/^[+\d\s()-]{6,20}$/.test(phone)) errors.phone = 'Teléfono no válido';
		return Object.keys(errors).length === 0;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;

		// Preserve contact history in notes JSON
		let finalNotes: string | undefined;
		if (initialData?.notes) {
			try {
				const parsed = JSON.parse(initialData.notes);
				parsed.text = notes;
				finalNotes = JSON.stringify(parsed);
			} catch {
				finalNotes = notes || undefined;
			}
		} else {
			finalNotes = notes || undefined;
		}

		const data: ClientInput = {
			fullName: fullName.trim(),
			email: email.trim() || undefined,
			phone: phone.trim() || undefined,
			address: address.trim() || undefined,
			notes: finalNotes,
			agentId: agentId ? Number(agentId) : undefined
		};

		onsubmit(data);
	}
</script>

<Card>
	<form class="space-y-6 p-6" onsubmit={handleSubmit}>
		<div class="grid gap-4 sm:grid-cols-2">
			<!-- Full Name -->
			<div class="sm:col-span-2">
				<label for="fullName" class="mb-1 block text-sm font-medium">
					Nombre completo <span class="text-destructive">*</span>
				</label>
				<Input
					id="fullName"
					bind:value={fullName}
					placeholder="Juan García López"
					error={errors.fullName}
					required
				/>
			</div>

			<!-- Email -->
			<div>
				<label for="email" class="mb-1 block text-sm font-medium">Email</label>
				<Input
					id="email"
					type="email"
					bind:value={email}
					placeholder="juan@ejemplo.com"
					error={errors.email}
				/>
			</div>

			<!-- Phone -->
			<div>
				<label for="phone" class="mb-1 block text-sm font-medium">Teléfono</label>
				<Input
					id="phone"
					type="tel"
					bind:value={phone}
					placeholder="+34 600 123 456"
					error={errors.phone}
				/>
			</div>

			<!-- Address -->
			<div class="sm:col-span-2">
				<label for="address" class="mb-1 block text-sm font-medium">Dirección</label>
				<Input
					id="address"
					bind:value={address}
					placeholder="Calle Principal 1, Madrid"
				/>
			</div>

			<!-- Agent ID -->
			<div>
				<label for="agentId" class="mb-1 block text-sm font-medium">ID Agente asignado</label>
				<Input
					id="agentId"
					type="number"
					bind:value={agentId}
					placeholder="Ej: 1"
				/>
			</div>

			<!-- Notes -->
			<div class="sm:col-span-2">
				<label for="notes" class="mb-1 block text-sm font-medium">Notas</label>
				<textarea
					id="notes"
					bind:value={notes}
					placeholder="Notas sobre el cliente, preferencias, observaciones..."
					rows="4"
					class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex justify-end gap-3 border-t pt-4">
			<Button variant="outline" type="button" onclick={oncancel}>Cancelar</Button>
			<Button type="submit" loading={saving}>
				{initialData ? 'Guardar Cambios' : 'Crear Cliente'}
			</Button>
		</div>
	</form>
</Card>
