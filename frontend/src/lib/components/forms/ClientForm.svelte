<script lang="ts">
	import type { Client, ClientInput, ClientStatus, ClientSource, ContactMethod, InterestType } from '$types';
	import Button from '$ui/Button.svelte';
	import Input from '$ui/Input.svelte';
	import Select from '$ui/Select.svelte';
	import Card from '$ui/Card.svelte';

	interface Props {
		initialData?: Client | null;
		saving?: boolean;
		onsubmit: (data: ClientInput) => void;
		oncancel: () => void;
	}

	let { initialData = null, saving = false, onsubmit, oncancel }: Props = $props();

	// Section toggle
	let activeSection = $state<'basic' | 'personal' | 'contact' | 'preferences' | 'crm'>('basic');

	// Basic Info
	let fullName = $state(initialData?.fullName || '');
	let email = $state(initialData?.email || '');
	let phone = $state(initialData?.phone || '');
	let address = $state(initialData?.address || '');
	let notes = $state('');
	let agentId = $state(initialData?.agentId?.toString() || '');

	// CRM Pipeline
	let status = $state<string>(initialData?.status || 'lead');
	let source = $state<string>(initialData?.source || 'other');
	let tags = $state(initialData?.tags || '');

	// Personal Info
	let dni = $state(initialData?.dni || '');
	let dateOfBirth = $state(initialData?.dateOfBirth?.split('T')[0] || '');
	let nationality = $state(initialData?.nationality || '');
	let occupation = $state(initialData?.occupation || '');
	let company = $state(initialData?.company || '');

	// Contact Preferences
	let phoneSecondary = $state(initialData?.phoneSecondary || '');
	let preferredContact = $state<string>(initialData?.preferredContact || 'phone');
	let preferredContactTime = $state(initialData?.preferredContactTime || '');
	let timezone = $state(initialData?.timezone || 'Europe/Madrid');
	let language = $state(initialData?.language || 'es');

	// Property Preferences
	let interestType = $state<string>(initialData?.interestType || 'buy');
	let budgetMin = $state(initialData?.budgetMin || '');
	let budgetMax = $state(initialData?.budgetMax || '');
	let preferredZones = $state(initialData?.preferredZones || '');
	let preferredPropertyTypes = $state(initialData?.preferredPropertyTypes || '');
	let minBedrooms = $state(initialData?.minBedrooms?.toString() || '');
	let minBathrooms = $state(initialData?.minBathrooms?.toString() || '');
	let minSurface = $state(initialData?.minSurface?.toString() || '');
	let needsGarage = $state(initialData?.needsGarage || false);
	let needsGarden = $state(initialData?.needsGarden || false);
	let additionalRequirements = $state(initialData?.additionalRequirements || '');
	let nextFollowupAt = $state(initialData?.nextFollowupAt?.split('.')[0] || '');

	// Parse notes
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

	// Options
	const statusOptions = [
		{ value: 'lead', label: '🔵 Lead' },
		{ value: 'contacted', label: '📞 Contactado' },
		{ value: 'qualified', label: '✅ Cualificado' },
		{ value: 'negotiating', label: '🤝 Negociando' },
		{ value: 'closed', label: '🎉 Cerrado' },
		{ value: 'lost', label: '❌ Perdido' },
	];

	const sourceOptions = [
		{ value: 'website', label: '🌐 Website' },
		{ value: 'referral', label: '👥 Referido' },
		{ value: 'walk_in', label: '🚶 Walk-in' },
		{ value: 'phone', label: '📞 Teléfono' },
		{ value: 'social_media', label: '📱 RRSS' },
		{ value: 'portal', label: '🏠 Portal inmobiliario' },
		{ value: 'advertising', label: '📣 Publicidad' },
		{ value: 'other', label: '📌 Otro' },
	];

	const contactMethodOptions = [
		{ value: 'phone', label: '📞 Teléfono' },
		{ value: 'email', label: '📧 Email' },
		{ value: 'whatsapp', label: '💬 WhatsApp' },
		{ value: 'in_person', label: '🤝 En persona' },
	];

	const interestOptions = [
		{ value: 'buy', label: '🏠 Comprar' },
		{ value: 'rent', label: '🔑 Alquilar' },
		{ value: 'both', label: '🏠🔑 Ambos' },
	];

	const contactTimeOptions = [
		{ value: '', label: '— Sin preferencia —' },
		{ value: 'morning', label: '🌅 Mañana (9-13h)' },
		{ value: 'afternoon', label: '☀️ Tarde (13-18h)' },
		{ value: 'evening', label: '🌙 Noche (18-21h)' },
		{ value: 'any', label: '🕐 Cualquier hora' },
	];

	const languageOptions = [
		{ value: 'es', label: '🇪🇸 Español' },
		{ value: 'en', label: '🇬🇧 Inglés' },
		{ value: 'fr', label: '🇫🇷 Francés' },
		{ value: 'de', label: '🇩🇪 Alemán' },
		{ value: 'pt', label: '🇵🇹 Portugués' },
		{ value: 'it', label: '🇮🇹 Italiano' },
		{ value: 'zh', label: '🇨🇳 Chino' },
		{ value: 'ar', label: '🇸🇦 Árabe' },
		{ value: 'ru', label: '🇷🇺 Ruso' },
	];

	function validate(): boolean {
		errors = {};
		if (!fullName.trim()) errors.fullName = 'El nombre es obligatorio';
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email no válido';
		if (phone && !/^[+\d\s()-]{6,20}$/.test(phone)) errors.phone = 'Teléfono no válido';
		if (phoneSecondary && !/^[+\d\s()-]{6,20}$/.test(phoneSecondary)) errors.phoneSecondary = 'Teléfono no válido';
		return Object.keys(errors).length === 0;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;

		// Preserve contact history in notes JSON if editing
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
			agentId: agentId ? Number(agentId) : undefined,
			status: status as ClientStatus,
			source: source as ClientSource,
			dni: dni.trim() || undefined,
			dateOfBirth: dateOfBirth || undefined,
			nationality: nationality.trim() || undefined,
			occupation: occupation.trim() || undefined,
			company: company.trim() || undefined,
			phoneSecondary: phoneSecondary.trim() || undefined,
			preferredContact: preferredContact as ContactMethod,
			preferredContactTime: preferredContactTime || undefined,
			timezone: timezone || undefined,
			language: language || undefined,
			interestType: interestType as InterestType,
			budgetMin: budgetMin || undefined,
			budgetMax: budgetMax || undefined,
			preferredZones: preferredZones.trim() || undefined,
			preferredPropertyTypes: preferredPropertyTypes.trim() || undefined,
			minBedrooms: minBedrooms ? Number(minBedrooms) : undefined,
			minBathrooms: minBathrooms ? Number(minBathrooms) : undefined,
			minSurface: minSurface ? Number(minSurface) : undefined,
			needsGarage,
			needsGarden,
			additionalRequirements: additionalRequirements.trim() || undefined,
			nextFollowupAt: nextFollowupAt || undefined,
			tags: tags.trim() || undefined,
		};

		onsubmit(data);
	}

	const sections = [
		{ key: 'basic', label: '📋 Básico', icon: '📋' },
		{ key: 'personal', label: '👤 Personal', icon: '👤' },
		{ key: 'contact', label: '📞 Contacto', icon: '📞' },
		{ key: 'preferences', label: '🏠 Preferencias', icon: '🏠' },
		{ key: 'crm', label: '📊 CRM', icon: '📊' },
	];
</script>

<Card>
	<form class="p-6" onsubmit={handleSubmit}>
		<!-- Section Tabs -->
		<div class="mb-6 flex flex-wrap gap-1 border-b pb-2">
			{#each sections as section}
				<button
					type="button"
					class="rounded-t-lg px-3 py-1.5 text-sm font-medium transition-colors {activeSection === section.key
						? 'bg-primary/10 text-primary'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeSection = section.key as typeof activeSection)}
				>
					{section.label}
				</button>
			{/each}
		</div>

		<!-- BASIC SECTION -->
		{#if activeSection === 'basic'}
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="fullName" class="mb-1 block text-sm font-medium">
						Nombre completo <span class="text-destructive">*</span>
					</label>
					<Input id="fullName" bind:value={fullName} placeholder="Juan García López" error={errors.fullName} required />
				</div>
				<div>
					<label for="email" class="mb-1 block text-sm font-medium">Email</label>
					<Input id="email" type="email" bind:value={email} placeholder="juan@ejemplo.com" error={errors.email} />
				</div>
				<div>
					<label for="phone" class="mb-1 block text-sm font-medium">Teléfono</label>
					<Input id="phone" type="tel" bind:value={phone} placeholder="+34 600 123 456" error={errors.phone} />
				</div>
				<div class="sm:col-span-2">
					<label for="address" class="mb-1 block text-sm font-medium">Dirección</label>
					<Input id="address" bind:value={address} placeholder="Calle Principal 1, Madrid" />
				</div>
				<div>
					<label for="agentId" class="mb-1 block text-sm font-medium">ID Agente asignado</label>
					<Input id="agentId" type="number" bind:value={agentId} placeholder="Ej: 1" />
				</div>
				<div>
					<label for="tags" class="mb-1 block text-sm font-medium">Etiquetas</label>
					<Input id="tags" bind:value={tags} placeholder='["VIP","Urgente"] o separadas por coma' />
				</div>
				<div class="sm:col-span-2">
					<label for="notes" class="mb-1 block text-sm font-medium">Notas</label>
					<textarea
						id="notes"
						bind:value={notes}
						placeholder="Notas sobre el cliente, preferencias, observaciones..."
						rows="3"
						class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					></textarea>
				</div>
			</div>
		{/if}

		<!-- PERSONAL SECTION -->
		{#if activeSection === 'personal'}
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="dni" class="mb-1 block text-sm font-medium">DNI / NIE / Pasaporte</label>
					<Input id="dni" bind:value={dni} placeholder="12345678A" />
				</div>
				<div>
					<label for="dateOfBirth" class="mb-1 block text-sm font-medium">Fecha de nacimiento</label>
					<Input id="dateOfBirth" type="date" bind:value={dateOfBirth} />
				</div>
				<div>
					<label for="nationality" class="mb-1 block text-sm font-medium">Nacionalidad</label>
					<Input id="nationality" bind:value={nationality} placeholder="Española" />
				</div>
				<div>
					<label for="language" class="mb-1 block text-sm font-medium">Idioma preferido</label>
					<Select id="language" options={languageOptions} bind:value={language} />
				</div>
				<div>
					<label for="occupation" class="mb-1 block text-sm font-medium">Ocupación</label>
					<Input id="occupation" bind:value={occupation} placeholder="Ingeniero, Médico, etc." />
				</div>
				<div>
					<label for="company" class="mb-1 block text-sm font-medium">Empresa</label>
					<Input id="company" bind:value={company} placeholder="Nombre de la empresa" />
				</div>
			</div>
		{/if}

		<!-- CONTACT SECTION -->
		{#if activeSection === 'contact'}
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="phoneSecondary" class="mb-1 block text-sm font-medium">Teléfono secundario</label>
					<Input id="phoneSecondary" type="tel" bind:value={phoneSecondary} placeholder="+34 600 000 000" error={errors.phoneSecondary} />
				</div>
				<div>
					<label for="preferredContact" class="mb-1 block text-sm font-medium">Método de contacto preferido</label>
					<Select id="preferredContact" options={contactMethodOptions} bind:value={preferredContact} />
				</div>
				<div>
					<label for="preferredContactTime" class="mb-1 block text-sm font-medium">Horario preferido</label>
					<Select id="preferredContactTime" options={contactTimeOptions} bind:value={preferredContactTime} />
				</div>
				<div>
					<label for="timezone" class="mb-1 block text-sm font-medium">Zona horaria</label>
					<Input id="timezone" bind:value={timezone} placeholder="Europe/Madrid" />
				</div>
				<div class="sm:col-span-2">
					<label for="nextFollowup" class="mb-1 block text-sm font-medium">Próximo seguimiento</label>
					<Input id="nextFollowup" type="datetime-local" bind:value={nextFollowupAt} />
				</div>
			</div>
		{/if}

		<!-- PREFERENCES SECTION -->
		{#if activeSection === 'preferences'}
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="interestType" class="mb-1 block text-sm font-medium">Tipo de interés</label>
					<Select id="interestType" options={interestOptions} bind:value={interestType} />
				</div>
				<div>
					<label for="budgetMin" class="mb-1 block text-sm font-medium">Presupuesto mínimo (€)</label>
					<Input id="budgetMin" type="number" bind:value={budgetMin} placeholder="100000" />
				</div>
				<div>
					<label for="budgetMax" class="mb-1 block text-sm font-medium">Presupuesto máximo (€)</label>
					<Input id="budgetMax" type="number" bind:value={budgetMax} placeholder="300000" />
				</div>
				<div>
					<label for="minBedrooms" class="mb-1 block text-sm font-medium">Mín. habitaciones</label>
					<Input id="minBedrooms" type="number" bind:value={minBedrooms} placeholder="2" />
				</div>
				<div>
					<label for="minBathrooms" class="mb-1 block text-sm font-medium">Mín. baños</label>
					<Input id="minBathrooms" type="number" bind:value={minBathrooms} placeholder="1" />
				</div>
				<div>
					<label for="minSurface" class="mb-1 block text-sm font-medium">Superficie mínima (m²)</label>
					<Input id="minSurface" type="number" bind:value={minSurface} placeholder="80" />
				</div>
				<div class="flex gap-6 items-center pt-6">
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={needsGarage} class="rounded border-gray-300" />
						<span class="text-sm">🅿️ Necesita garaje</span>
					</label>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={needsGarden} class="rounded border-gray-300" />
						<span class="text-sm">🌿 Necesita jardín</span>
					</label>
				</div>
				<div class="sm:col-span-2">
					<label for="preferredZones" class="mb-1 block text-sm font-medium">Zonas preferidas</label>
					<Input id="preferredZones" bind:value={preferredZones} placeholder='["Centro","Ensanche","Playa"] o separadas por coma' />
					<p class="mt-1 text-xs text-muted-foreground">JSON array o valores separados por coma</p>
				</div>
				<div class="sm:col-span-2">
					<label for="preferredPropertyTypes" class="mb-1 block text-sm font-medium">Tipos de propiedad</label>
					<Input id="preferredPropertyTypes" bind:value={preferredPropertyTypes} placeholder='["apartment","house"] o separadas por coma' />
				</div>
				<div class="sm:col-span-2">
					<label for="additionalRequirements" class="mb-1 block text-sm font-medium">Requisitos adicionales</label>
					<textarea
						id="additionalRequirements"
						bind:value={additionalRequirements}
						placeholder="Ascensor, terraza, vistas al mar, cerca de colegios..."
						rows="3"
						class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					></textarea>
				</div>
			</div>
		{/if}

		<!-- CRM SECTION -->
		{#if activeSection === 'crm'}
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="status" class="mb-1 block text-sm font-medium">Estado del pipeline</label>
					<Select id="status" options={statusOptions} bind:value={status} />
				</div>
				<div>
					<label for="source" class="mb-1 block text-sm font-medium">Fuente de captación</label>
					<Select id="source" options={sourceOptions} bind:value={source} />
				</div>
			</div>
		{/if}

		<!-- Actions -->
		<div class="mt-6 flex justify-end gap-3 border-t pt-4">
			<Button variant="outline" type="button" onclick={oncancel}>Cancelar</Button>
			<Button type="submit" loading={saving}>
				{initialData ? '💾 Guardar Cambios' : '➕ Crear Cliente'}
			</Button>
		</div>
	</form>
</Card>
