import { writable, derived } from 'svelte/store';
import type { Property, PropertyFilters, PaginatedResponse } from '$types';
import { propertiesApi } from '$api/client';
import { toast } from './toast';

interface PropertiesState {
	items: Property[];
	selected: Property | null;
	loading: boolean;
	error: string | null;
	page: number;
	limit: number;
	totalPages: number;
	total: number;
	filters: PropertyFilters;
	selectedIds: Set<number>;
	viewMode: 'grid' | 'table';
}

function createPropertiesStore() {
	const initial: PropertiesState = {
		items: [],
		selected: null,
		loading: false,
		error: null,
		page: 1,
		limit: 12,
		totalPages: 0,
		total: 0,
		filters: {},
		selectedIds: new Set(),
		viewMode: 'grid'
	};

	const { subscribe, set, update } = writable<PropertiesState>(initial);

	async function fetchAll() {
		console.log('[properties] fetchAll called');
		update((s) => ({ ...s, loading: true, error: null }));
		try {
			let state: PropertiesState = initial;
			subscribe((s) => (state = s))();
			console.log('[properties] calling API with page:', state.page, 'limit:', state.limit);

			const res: PaginatedResponse<Property> = await propertiesApi.list(
				state.page,
				state.limit,
				state.filters
			);
			console.log('[properties] got response, items:', res.data?.length, 'total:', res.pagination?.total);
			update((s) => ({
				...s,
				items: res.data,
				total: res.pagination.total,
				totalPages: res.pagination.totalPages,
				page: res.pagination.page,
				loading: false
			}));
		} catch (e) {
			console.error('[properties] fetchAll error:', e);
			const msg = e instanceof Error ? e.message : 'Error loading properties';
			update((s) => ({ ...s, loading: false, error: msg }));
			toast.error(msg);
		}
	}

	async function fetchOne(id: number) {
		update((s) => ({ ...s, loading: true, error: null }));
		try {
			const res = await propertiesApi.get(id);
			if (res.success && res.data) {
				update((s) => ({ ...s, selected: res.data!, loading: false }));
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Error loading property';
			update((s) => ({ ...s, loading: false, error: msg }));
			toast.error(msg);
		}
	}

	async function create(data: Parameters<typeof propertiesApi.create>[0]) {
		update((s) => ({ ...s, loading: true }));
		try {
			const res = await propertiesApi.create(data);
			if (res.success) {
				toast.success('Propiedad creada correctamente');
				await fetchAll();
			}
			return res;
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Error creating property';
			update((s) => ({ ...s, loading: false }));
			toast.error(msg);
			throw e;
		}
	}

	async function updateProperty(id: number, data: Parameters<typeof propertiesApi.update>[1]) {
		update((s) => ({ ...s, loading: true }));
		try {
			const res = await propertiesApi.update(id, data);
			if (res.success) {
				toast.success('Propiedad actualizada correctamente');
				await fetchAll();
			}
			return res;
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Error updating property';
			update((s) => ({ ...s, loading: false }));
			toast.error(msg);
			throw e;
		}
	}

	async function remove(id: number) {
		try {
			await propertiesApi.delete(id);
			toast.success('Propiedad eliminada');
			await fetchAll();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Error deleting property');
		}
	}

	async function bulkDelete(ids: number[]) {
		update((s) => ({ ...s, loading: true }));
		try {
			await Promise.all(ids.map((id) => propertiesApi.delete(id)));
			toast.success(`${ids.length} propiedades eliminadas`);
			update((s) => ({ ...s, selectedIds: new Set() }));
			await fetchAll();
		} catch (e) {
			toast.error('Error en eliminación masiva');
			update((s) => ({ ...s, loading: false }));
		}
	}

	async function bulkUpdateStatus(ids: number[], status: string) {
		update((s) => ({ ...s, loading: true }));
		try {
			await Promise.all(ids.map((id) => propertiesApi.update(id, { status: status as any })));
			toast.success(`${ids.length} propiedades actualizadas`);
			update((s) => ({ ...s, selectedIds: new Set() }));
			await fetchAll();
		} catch (e) {
			toast.error('Error en actualización masiva');
			update((s) => ({ ...s, loading: false }));
		}
	}

	function setPage(page: number) {
		update((s) => ({ ...s, page }));
		fetchAll();
	}

	function setFilters(filters: PropertyFilters) {
		update((s) => ({ ...s, filters, page: 1 }));
		fetchAll();
	}

	function toggleView() {
		update((s) => ({ ...s, viewMode: s.viewMode === 'grid' ? 'table' : 'grid' }));
	}

	function toggleSelect(id: number) {
		update((s) => {
			const ids = new Set(s.selectedIds);
			if (ids.has(id)) ids.delete(id);
			else ids.add(id);
			return { ...s, selectedIds: ids };
		});
	}

	function selectAll() {
		update((s) => ({
			...s,
			selectedIds: new Set(s.items.map((p) => p.id))
		}));
	}

	function clearSelection() {
		update((s) => ({ ...s, selectedIds: new Set() }));
	}

	function reset() {
		set(initial);
	}

	return {
		subscribe,
		fetchAll,
		fetchOne,
		create,
		update: updateProperty,
		remove,
		bulkDelete,
		bulkUpdateStatus,
		setPage,
		setFilters,
		toggleView,
		toggleSelect,
		selectAll,
		clearSelection,
		reset
	};
}

export const properties = createPropertiesStore();
