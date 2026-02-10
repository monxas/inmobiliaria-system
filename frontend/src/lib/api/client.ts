import type {
	ApiResponse,
	PaginatedResponse,
	AuthResponse,
	LoginPayload,
	RegisterPayload,
	User,
	Property,
	Client,
	Document,
	PropertyInput,
	ClientInput,
	UserInput,
	PropertyFilters,
	ClientFilters,
	UserFilters,
	DocumentFilters
} from '$types';

const API_BASE = '/api';

// ============================================
// Token Management
// ============================================

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
	accessToken = access;
	refreshToken = refresh;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('accessToken', access);
		localStorage.setItem('refreshToken', refresh);
	}
}

export function getAccessToken(): string | null {
	if (accessToken) return accessToken;
	if (typeof localStorage !== 'undefined') {
		accessToken = localStorage.getItem('accessToken');
		return accessToken;
	}
	return null;
}

export function getRefreshToken(): string | null {
	if (refreshToken) return refreshToken;
	if (typeof localStorage !== 'undefined') {
		refreshToken = localStorage.getItem('refreshToken');
		return refreshToken;
	}
	return null;
}

export function clearTokens() {
	accessToken = null;
	refreshToken = null;
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem('accessToken');
		localStorage.removeItem('refreshToken');
	}
}

// ============================================
// HTTP Client
// ============================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface FetchOptions {
	method?: HttpMethod;
	body?: unknown;
	params?: Record<string, string | number | boolean | undefined>;
	skipAuth?: boolean;
}

class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public data?: unknown
	) {
		super(message);
		this.name = 'ApiError';
	}
}

async function refreshAccessToken(): Promise<boolean> {
	const refresh = getRefreshToken();
	if (!refresh) return false;

	try {
		const response = await fetch(`${API_BASE}/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refreshToken: refresh })
		});

		if (!response.ok) {
			clearTokens();
			return false;
		}

		const data: AuthResponse = await response.json();
		if (data.success && data.data) {
			setTokens(data.data.accessToken, data.data.refreshToken);
			return true;
		}
		return false;
	} catch {
		clearTokens();
		return false;
	}
}

async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
	const { method = 'GET', body, params, skipAuth = false } = options;

	let url = `${API_BASE}${endpoint}`;
	if (params) {
		const searchParams = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== '') {
				searchParams.append(key, String(value));
			}
		});
		const queryString = searchParams.toString();
		if (queryString) url += `?${queryString}`;
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (!skipAuth) {
		const token = getAccessToken();
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}
	}

	const fetchOptions: RequestInit = {
		method,
		headers
	};

	if (body && method !== 'GET') {
		fetchOptions.body = JSON.stringify(body);
	}

	let response = await fetch(url, fetchOptions);

	// Handle token refresh on 401
	if (response.status === 401 && !skipAuth) {
		const refreshed = await refreshAccessToken();
		if (refreshed) {
			headers['Authorization'] = `Bearer ${getAccessToken()}`;
			response = await fetch(url, { ...fetchOptions, headers });
		} else {
			clearTokens();
			if (typeof window !== 'undefined') {
				window.location.href = '/auth/login';
			}
			throw new ApiError(401, 'Session expired');
		}
	}

	const data = await response.json();

	if (!response.ok) {
		throw new ApiError(response.status, data.error || data.message || 'API Error', data);
	}

	return data;
}

// ============================================
// Auth API
// ============================================

export const authApi = {
	async login(payload: LoginPayload): Promise<AuthResponse> {
		const response = await request<AuthResponse>('/auth/login', {
			method: 'POST',
			body: payload,
			skipAuth: true
		});
		if (response.success && response.data) {
			setTokens(response.data.accessToken, response.data.refreshToken);
		}
		return response;
	},

	async register(payload: RegisterPayload): Promise<AuthResponse> {
		const response = await request<AuthResponse>('/auth/register', {
			method: 'POST',
			body: payload,
			skipAuth: true
		});
		if (response.success && response.data) {
			setTokens(response.data.accessToken, response.data.refreshToken);
		}
		return response;
	},

	async logout(): Promise<void> {
		try {
			await request('/auth/logout', { method: 'POST' });
		} finally {
			clearTokens();
		}
	},

	async me(): Promise<ApiResponse<User>> {
		return request('/auth/me');
	},

	async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
		return request('/auth/me', { method: 'PUT', body: data });
	}
};

// ============================================
// Properties API
// ============================================

export const propertiesApi = {
	async list(
		page = 1,
		limit = 10,
		filters?: PropertyFilters
	): Promise<PaginatedResponse<Property>> {
		return request('/properties', {
			params: { page, limit, ...filters }
		});
	},

	async get(id: number): Promise<ApiResponse<Property>> {
		return request(`/properties/${id}`);
	},

	async create(data: PropertyInput): Promise<ApiResponse<Property>> {
		return request('/properties', { method: 'POST', body: data });
	},

	async update(id: number, data: Partial<PropertyInput>): Promise<ApiResponse<Property>> {
		return request(`/properties/${id}`, { method: 'PUT', body: data });
	},

	async delete(id: number): Promise<ApiResponse<void>> {
		return request(`/properties/${id}`, { method: 'DELETE' });
	}
};

// ============================================
// Clients API
// ============================================

export const clientsApi = {
	async list(page = 1, limit = 10, filters?: ClientFilters): Promise<PaginatedResponse<Client>> {
		return request('/clients', {
			params: { page, limit, ...filters }
		});
	},

	async get(id: number): Promise<ApiResponse<Client>> {
		return request(`/clients/${id}`);
	},

	async create(data: ClientInput): Promise<ApiResponse<Client>> {
		return request('/clients', { method: 'POST', body: data });
	},

	async update(id: number, data: Partial<ClientInput>): Promise<ApiResponse<Client>> {
		return request(`/clients/${id}`, { method: 'PUT', body: data });
	},

	async delete(id: number): Promise<ApiResponse<void>> {
		return request(`/clients/${id}`, { method: 'DELETE' });
	}
};

// ============================================
// Users API (Admin only)
// ============================================

export const usersApi = {
	async list(page = 1, limit = 10, filters?: UserFilters): Promise<PaginatedResponse<User>> {
		return request('/users', {
			params: { page, limit, ...filters }
		});
	},

	async get(id: number): Promise<ApiResponse<User>> {
		return request(`/users/${id}`);
	},

	async create(data: UserInput): Promise<ApiResponse<User>> {
		return request('/users', { method: 'POST', body: data });
	},

	async update(id: number, data: Partial<UserInput>): Promise<ApiResponse<User>> {
		return request(`/users/${id}`, { method: 'PUT', body: data });
	},

	async delete(id: number): Promise<ApiResponse<void>> {
		return request(`/users/${id}`, { method: 'DELETE' });
	}
};

// ============================================
// Documents API
// ============================================

export const documentsApi = {
	async list(
		page = 1,
		limit = 10,
		filters?: DocumentFilters
	): Promise<PaginatedResponse<Document>> {
		return request('/documents', {
			params: { page, limit, ...filters }
		});
	},

	async get(id: number): Promise<ApiResponse<Document>> {
		return request(`/documents/${id}`);
	},

	async upload(file: File, category: string, metadata?: Record<string, number>): Promise<ApiResponse<Document>> {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('category', category);
		if (metadata?.propertyId) formData.append('propertyId', String(metadata.propertyId));
		if (metadata?.clientId) formData.append('clientId', String(metadata.clientId));

		const token = getAccessToken();
		const response = await fetch(`${API_BASE}/documents/upload`, {
			method: 'POST',
			headers: token ? { Authorization: `Bearer ${token}` } : {},
			body: formData
		});

		const data = await response.json();
		if (!response.ok) {
			throw new ApiError(response.status, data.error || 'Upload failed', data);
		}
		return data;
	},

	async delete(id: number): Promise<ApiResponse<void>> {
		return request(`/documents/${id}`, { method: 'DELETE' });
	},

	getDownloadUrl(id: number): string {
		return `${API_BASE}/documents/${id}/download`;
	}
};

// ============================================
// Dashboard Stats
// ============================================

export const dashboardApi = {
	async getStats(): Promise<ApiResponse<{
		properties: { total: number; available: number; sold: number; rented: number };
		clients: { total: number };
		users: { total: number; agents: number };
		documents: { total: number };
	}>> {
		// Aggregate stats from multiple endpoints
		const [properties, clients, users] = await Promise.all([
			propertiesApi.list(1, 1),
			clientsApi.list(1, 1),
			usersApi.list(1, 1).catch(() => ({ pagination: { total: 0 }, data: [] }))
		]);

		return {
			success: true,
			data: {
				properties: {
					total: properties.pagination.total,
					available: 0, // Would need dedicated endpoint
					sold: 0,
					rented: 0
				},
				clients: { total: clients.pagination.total },
				users: { total: users.pagination.total, agents: 0 },
				documents: { total: 0 }
			}
		};
	}
};
