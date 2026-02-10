import { writable, derived } from 'svelte/store';
import type { User } from '$types';
import { authApi, getAccessToken, clearTokens } from '$api/client';
import { browser } from '$app/environment';

interface AuthState {
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	error: string | null;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		isLoading: true,
		isAuthenticated: false,
		error: null
	});

	async function initialize() {
		if (!browser) return;
		
		const token = getAccessToken();
		if (!token) {
			set({ user: null, isLoading: false, isAuthenticated: false, error: null });
			return;
		}

		try {
			const response = await authApi.me();
			if (response.success && response.data) {
				set({
					user: response.data,
					isLoading: false,
					isAuthenticated: true,
					error: null
				});
			} else {
				clearTokens();
				set({ user: null, isLoading: false, isAuthenticated: false, error: null });
			}
		} catch {
			clearTokens();
			set({ user: null, isLoading: false, isAuthenticated: false, error: null });
		}
	}

	async function login(email: string, password: string): Promise<boolean> {
		update((state) => ({ ...state, isLoading: true, error: null }));
		
		try {
			const response = await authApi.login({ email, password });
			if (response.success && response.data) {
				set({
					user: response.data.user,
					isLoading: false,
					isAuthenticated: true,
					error: null
				});
				return true;
			}
			update((state) => ({ ...state, isLoading: false, error: 'Login failed' }));
			return false;
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Login failed';
			update((state) => ({ ...state, isLoading: false, error }));
			return false;
		}
	}

	async function register(email: string, password: string, fullName: string): Promise<boolean> {
		update((state) => ({ ...state, isLoading: true, error: null }));
		
		try {
			const response = await authApi.register({ email, password, fullName });
			if (response.success && response.data) {
				set({
					user: response.data.user,
					isLoading: false,
					isAuthenticated: true,
					error: null
				});
				return true;
			}
			update((state) => ({ ...state, isLoading: false, error: 'Registration failed' }));
			return false;
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Registration failed';
			update((state) => ({ ...state, isLoading: false, error }));
			return false;
		}
	}

	async function logout(): Promise<void> {
		try {
			await authApi.logout();
		} catch {
			// Ignore logout errors
		}
		clearTokens();
		set({ user: null, isLoading: false, isAuthenticated: false, error: null });
	}

	return {
		subscribe,
		initialize,
		login,
		register,
		logout
	};
}

export const auth = createAuthStore();

// Derived stores for convenience
export const user = derived(auth, ($auth) => $auth.user);
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const isLoading = derived(auth, ($auth) => $auth.isLoading);
export const isAdmin = derived(auth, ($auth) => $auth.user?.role === 'admin');
export const isAgent = derived(auth, ($auth) => $auth.user?.role === 'agent' || $auth.user?.role === 'admin');
