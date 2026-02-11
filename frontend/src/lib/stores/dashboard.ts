import { writable, derived } from 'svelte/store';
import { propertiesApi, clientsApi, documentsApi, usersApi } from '$api/client';
import type { Property, Client, Document } from '$types';
import { browser } from '$app/environment';

export interface DashboardStats {
	properties: { total: number; available: number; sold: number; rented: number; reserved: number; offMarket: number };
	clients: { total: number };
	documents: { total: number };
	users: { total: number; agents: number };
	revenue: { total: number; monthly: number };
}

export interface DashboardState {
	stats: DashboardStats | null;
	recentProperties: Property[];
	recentClients: Client[];
	recentDocuments: Document[];
	isLoading: boolean;
	error: string | null;
	lastUpdated: Date | null;
}

const defaultStats: DashboardStats = {
	properties: { total: 0, available: 0, sold: 0, rented: 0, reserved: 0, offMarket: 0 },
	clients: { total: 0 },
	documents: { total: 0 },
	users: { total: 0, agents: 0 },
	revenue: { total: 0, monthly: 0 }
};

function createDashboardStore() {
	const { subscribe, set, update } = writable<DashboardState>({
		stats: null,
		recentProperties: [],
		recentClients: [],
		recentDocuments: [],
		isLoading: false,
		error: null,
		lastUpdated: null
	});

	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	async function load() {
		update(s => ({ ...s, isLoading: true, error: null }));

		try {
			const [propsRes, clientsRes, docsRes, usersRes] = await Promise.allSettled([
				propertiesApi.list(1, 50),
				clientsApi.list(1, 50),
				documentsApi.list(1, 50),
				usersApi.list(1, 50)
			]);

			const properties = propsRes.status === 'fulfilled' ? propsRes.value : null;
			const clients = clientsRes.status === 'fulfilled' ? clientsRes.value : null;
			const docs = docsRes.status === 'fulfilled' ? docsRes.value : null;
			const users = usersRes.status === 'fulfilled' ? usersRes.value : null;

			const allProps = properties?.data || [];
			const allClients = clients?.data || [];
			const allDocs = docs?.data || [];
			const allUsers = users?.data || [];

			// Calculate stats from actual data
			const available = allProps.filter(p => p.status === 'available').length;
			const sold = allProps.filter(p => p.status === 'sold').length;
			const rented = allProps.filter(p => p.status === 'rented').length;
			const reserved = allProps.filter(p => p.status === 'reserved').length;
			const offMarket = allProps.filter(p => p.status === 'off_market').length;

			const totalRevenue = allProps
				.filter(p => p.status === 'sold' || p.status === 'rented')
				.reduce((sum, p) => sum + parseFloat(p.price || '0'), 0);

			// Monthly revenue (properties sold/rented this month)
			const now = new Date();
			const thisMonth = allProps
				.filter(p => {
					if (p.status !== 'sold' && p.status !== 'rented') return false;
					const d = new Date(p.updatedAt || p.createdAt);
					return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
				})
				.reduce((sum, p) => sum + parseFloat(p.price || '0'), 0);

			const stats: DashboardStats = {
				properties: {
					total: properties?.pagination?.total || allProps.length,
					available, sold, rented, reserved, offMarket
				},
				clients: { total: clients?.pagination?.total || allClients.length },
				documents: { total: docs?.pagination?.total || allDocs.length },
				users: {
					total: users?.pagination?.total || allUsers.length,
					agents: allUsers.filter(u => u.role === 'agent').length
				},
				revenue: { total: totalRevenue, monthly: thisMonth }
			};

			// Sort by createdAt desc for recent items
			const sortByDate = <T extends { createdAt: string }>(arr: T[]) =>
				[...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

			set({
				stats,
				recentProperties: sortByDate(allProps).slice(0, 5),
				recentClients: sortByDate(allClients).slice(0, 5),
				recentDocuments: sortByDate(allDocs).slice(0, 5),
				isLoading: false,
				error: null,
				lastUpdated: new Date()
			});
		} catch (e) {
			update(s => ({
				...s,
				isLoading: false,
				error: e instanceof Error ? e.message : 'Failed to load dashboard data'
			}));
		}
	}

	function startAutoRefresh(intervalMs = 5 * 60 * 1000) {
		stopAutoRefresh();
		if (browser) {
			refreshInterval = setInterval(load, intervalMs);
		}
	}

	function stopAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	return {
		subscribe,
		load,
		startAutoRefresh,
		stopAutoRefresh
	};
}

export const dashboard = createDashboardStore();
