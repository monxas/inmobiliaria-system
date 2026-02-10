import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'info' | 'warning';
	message: string;
	duration?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function add(toast: Omit<Toast, 'id'>) {
		const id = Math.random().toString(36).substring(2, 9);
		const newToast: Toast = { ...toast, id };
		
		update((toasts) => [...toasts, newToast]);

		const duration = toast.duration ?? 5000;
		if (duration > 0) {
			setTimeout(() => {
				remove(id);
			}, duration);
		}

		return id;
	}

	function remove(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	function success(message: string, duration?: number) {
		return add({ type: 'success', message, duration });
	}

	function error(message: string, duration?: number) {
		return add({ type: 'error', message, duration });
	}

	function info(message: string, duration?: number) {
		return add({ type: 'info', message, duration });
	}

	function warning(message: string, duration?: number) {
		return add({ type: 'warning', message, duration });
	}

	return {
		subscribe,
		add,
		remove,
		success,
		error,
		info,
		warning
	};
}

export const toast = createToastStore();
