import { writable, derived } from 'svelte/store';
import type { Client, ClientFilters, PaginatedResponse } from '$types';
import { clientsApi } from '$api/client';
import { toast } from './toast';

// ============================================
// Client Status Types (CRM pipeline)
// ============================================

export type ClientStatus = 'lead' | 'contacted' | 'qualified' | 'negotiating' | 'closed' | 'lost';

export const CLIENT_STATUSES: { value: ClientStatus; label: string; color: string; icon: string }[] = [
	{ value: 'lead', label: 'Lead', color: 'bg-blue-100 text-blue-800', icon: '🔵' },
	{ value: 'contacted', label: 'Contactado', color: 'bg-yellow-100 text-yellow-800', icon: '📞' },
	{ value: 'qualified', label: 'Cualificado', color: 'bg-orange-100 text-orange-800', icon: '✅' },
	{ value: 'negotiating', label: 'Negociando', color: 'bg-purple-100 text-purple-800', icon: '🤝' },
	{ value: 'closed', label: 'Cerrado', color: 'bg-green-100 text-green-800', icon: '🎉' },
	{ value: 'lost', label: 'Perdido', color: 'bg-red-100 text-red-800', icon: '❌' }
];

// ============================================
// Contact History Types
// ============================================

export type ContactType = 'call' | 'email' | 'meeting' | 'whatsapp' | 'visit' | 'note';

export interface ContactEntry {
	id: string;
	type: ContactType;
	date: string;
	summary: string;
	details?: string;
}

export const CONTACT_TYPES: { value: ContactType; label: string; icon: string }[] = [
	{ value: 'call', label: 'Llamada', icon: '📞' },
	{ value: 'email', label: 'Email', icon: '📧' },
	{ value: 'meeting', label: 'Reunión', icon: '🤝' },
	{ value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
	{ value: 'visit', label: 'Visita', icon: '🏠' },
	{ value: 'note', label: 'Nota', icon: '📝' }
];

// ============================================
// Clients Store
// ============================================

interface ClientsState {
	clients: Client[];
	selectedClient: Client | null;
	pagination: { total: number; page: number; limit: number; totalPages: number };
	filters: ClientFilters;
	isLoading: boolean;
	error: string | null;
}

function createClientsStore() {
	const { subscribe, set, update } = writable<ClientsState>({
		clients: [],
		selectedClient: null,
		pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
		filters: {},
		isLoading: false,
		error: null
	});

	async function fetchClients(page = 1, limit = 10, filters: ClientFilters = {}) {
		update((s) => ({ ...s, isLoading: true, error: null, filters }));
		try {
			const response = await clientsApi.list(page, limit, filters);
			update((s) => ({
				...s,
				clients: response.data,
				pagination: response.pagination,
				isLoading: false
			}));
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Error loading clients';
			update((s) => ({ ...s, isLoading: false, error }));
			toast.error(error);
		}
	}

	async function fetchClient(id: number) {
		update((s) => ({ ...s, isLoading: true, error: null }));
		try {
			const response = await clientsApi.get(id);
			if (response.success && response.data) {
				update((s) => ({ ...s, selectedClient: response.data!, isLoading: false }));
				return response.data;
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Error loading client';
			update((s) => ({ ...s, isLoading: false, error }));
			toast.error(error);
		}
		return null;
	}

	async function createClient(data: Parameters<typeof clientsApi.create>[0]) {
		try {
			const response = await clientsApi.create(data);
			if (response.success) {
				toast.success('Cliente creado correctamente');
				return response.data;
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Error creating client';
			toast.error(error);
		}
		return null;
	}

	async function updateClient(id: number, data: Parameters<typeof clientsApi.update>[1]) {
		try {
			const response = await clientsApi.update(id, data);
			if (response.success) {
				toast.success('Cliente actualizado correctamente');
				// Update in list if present
				update((s) => ({
					...s,
					clients: s.clients.map((c) => (c.id === id && response.data ? response.data : c)),
					selectedClient: s.selectedClient?.id === id && response.data ? response.data : s.selectedClient
				}));
				return response.data;
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Error updating client';
			toast.error(error);
		}
		return null;
	}

	async function deleteClient(id: number) {
		try {
			await clientsApi.delete(id);
			toast.success('Cliente eliminado correctamente');
			update((s) => ({
				...s,
				clients: s.clients.filter((c) => c.id !== id),
				pagination: { ...s.pagination, total: s.pagination.total - 1 }
			}));
			return true;
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Error deleting client';
			toast.error(error);
			return false;
		}
	}

	return {
		subscribe,
		fetchClients,
		fetchClient,
		createClient,
		updateClient,
		deleteClient
	};
}

export const clients = createClientsStore();
