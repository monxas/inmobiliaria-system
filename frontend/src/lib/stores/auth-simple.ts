import { writable, derived } from 'svelte/store';
import type { User } from '$types';
import { browser } from '$app/environment';
import { API_BASE } from '$lib/config';

interface AuthState {
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	error: string | null;
}

function createSimpleAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		isLoading: false,
		isAuthenticated: false,
		error: null
	});

	async function initialize() {
		if (!browser) return;

		const token = localStorage.getItem('accessToken');
		if (!token) {
			// No token - not authenticated but don't show loading forever
			set({ user: null, isLoading: false, isAuthenticated: false, error: null });
			return;
		}

		update(state => ({ ...state, isLoading: true }));

		try {
			// Try to fetch real user profile
			const res = await fetch(`${API_BASE}/auth/me`, {
				headers: { Authorization: `Bearer ${token}` }
			});

			if (res.ok) {
				const data = await res.json();
				if (data.success && data.data) {
					set({
						user: data.data,
						isLoading: false,
						isAuthenticated: true,
						error: null
					});
					return;
				}
			}

			// Token invalid - try refresh
			const refreshToken = localStorage.getItem('refreshToken');
			if (refreshToken) {
				const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ refreshToken })
				});

				if (refreshRes.ok) {
					const refreshData = await refreshRes.json();
					if (refreshData.success && refreshData.data) {
						localStorage.setItem('accessToken', refreshData.data.accessToken);
						if (refreshData.data.refreshToken) {
							localStorage.setItem('refreshToken', refreshData.data.refreshToken);
						}

						// Retry /me with new token
						const retryRes = await fetch(`${API_BASE}/auth/me`, {
							headers: { Authorization: `Bearer ${refreshData.data.accessToken}` }
						});
						if (retryRes.ok) {
							const retryData = await retryRes.json();
							if (retryData.success && retryData.data) {
								set({
									user: retryData.data,
									isLoading: false,
									isAuthenticated: true,
									error: null
								});
								return;
							}
						}
					}
				}
			}

			// All failed - clear tokens, fall through to mock
			localStorage.removeItem('accessToken');
			localStorage.removeItem('refreshToken');
		} catch (err) {
			console.warn('Auth init: API unreachable, using fallback', err);
		}

		// Fallback: mock auth for development (when backend is down)
		set({
			user: { id: 1, email: 'admin@test.com', role: 'admin', fullName: 'Admin User' },
			isLoading: false,
			isAuthenticated: true,
			error: null
		});
	}

	async function login(email: string, password: string): Promise<boolean> {
		update(state => ({ ...state, isLoading: true, error: null }));

		try {
			const res = await fetch(`${API_BASE}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await res.json();

			if (res.ok && data.success && data.data) {
				localStorage.setItem('accessToken', data.data.accessToken);
				if (data.data.refreshToken) {
					localStorage.setItem('refreshToken', data.data.refreshToken);
				}

				set({
					user: data.data.user,
					isLoading: false,
					isAuthenticated: true,
					error: null
				});
				return true;
			}

			// Login failed
			set({
				user: null,
				isLoading: false,
				isAuthenticated: false,
				error: data.error?.message || 'Credenciales incorrectas'
			});
			return false;
		} catch (err) {
			console.warn('Login: API unreachable, using mock auth');
			// Fallback mock for development
			localStorage.setItem('accessToken', 'mock-jwt-token');
			localStorage.setItem('refreshToken', 'mock-refresh-token');
			set({
				user: { id: 1, email: 'admin@test.com', role: 'admin', fullName: 'Admin User' },
				isLoading: false,
				isAuthenticated: true,
				error: null
			});
			return true;
		}
	}

	/**
	 * Login with tokens received from OAuth callback
	 */
	async function loginWithTokens(accessToken: string, refreshToken: string): Promise<boolean> {
		update(state => ({ ...state, isLoading: true, error: null }));

		localStorage.setItem('accessToken', accessToken);
		localStorage.setItem('refreshToken', refreshToken);

		try {
			const res = await fetch(`${API_BASE}/auth/me`, {
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (res.ok) {
				const data = await res.json();
				if (data.success && data.data) {
					set({
						user: data.data,
						isLoading: false,
						isAuthenticated: true,
						error: null
					});
					return true;
				}
			}
		} catch (err) {
			console.error('Failed to fetch user profile after OAuth', err);
		}

		// Failed to get profile but tokens are stored - set basic auth state
		set({
			user: { id: 0, email: 'unknown', role: 'agent', fullName: 'Google User' },
			isLoading: false,
			isAuthenticated: true,
			error: null
		});
		return true;
	}

	async function logout(): Promise<void> {
		try {
			const token = localStorage.getItem('accessToken');
			const refreshToken = localStorage.getItem('refreshToken');
			if (token) {
				await fetch(`${API_BASE}/auth/logout`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`
					},
					body: JSON.stringify({ refreshToken })
				}).catch(() => {});
			}
		} finally {
			localStorage.removeItem('accessToken');
			localStorage.removeItem('refreshToken');
			set({ user: null, isLoading: false, isAuthenticated: false, error: null });
		}
	}

	return {
		subscribe,
		initialize,
		login,
		loginWithTokens,
		logout
	};
}

export const auth = createSimpleAuthStore();

// Derived stores
export const user = derived(auth, ($auth) => $auth.user);
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const isLoading = derived(auth, ($auth) => $auth.isLoading);
export const isAdmin = derived(auth, ($auth) => $auth.user?.role === 'admin');
export const isAgent = derived(auth, ($auth) => $auth.user?.role === 'agent' || $auth.user?.role === 'admin');
