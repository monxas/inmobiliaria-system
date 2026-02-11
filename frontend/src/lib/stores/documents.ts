/**
 * Documents & file upload store with upload progress tracking.
 */
import { writable, derived } from 'svelte/store';
import { getAccessToken } from '$lib/api/client';
import type { Document, FileCategory, DocumentFilters } from '$types';

// ============================================
// Types
// ============================================

export interface UploadItem {
	id: string;
	file: File;
	name: string;
	size: number;
	type: string;
	progress: number; // 0-100
	status: 'pending' | 'uploading' | 'compressing' | 'done' | 'error';
	error?: string;
	thumbnail?: string;
	result?: Document;
}

export interface ShareLinkConfig {
	permission: 'view' | 'download' | 'edit';
	expiresIn: number | null; // hours, null = never
	password?: string;
	maxDownloads?: number;
	recipientEmail?: string;
	recipientName?: string;
	message?: string;
	notifyOnAccess?: boolean;
}

export interface ShareLink {
	id: number;
	shareToken: string;
	shortCode?: string;
	url: string;
	permission: string;
	expiresAt?: string;
	maxDownloads?: number;
	currentDownloads: number;
	isActive: boolean;
	createdAt: string;
}

// ============================================
// Upload Queue Store
// ============================================

function createUploadStore() {
	const { subscribe, update, set } = writable<UploadItem[]>([]);

	function addFiles(files: File[], thumbnails?: Map<string, string>): string[] {
		const ids: string[] = [];
		update(items => {
			const newItems = files.map(file => {
				const id = crypto.randomUUID();
				ids.push(id);
				return {
					id,
					file,
					name: file.name,
					size: file.size,
					type: file.type,
					progress: 0,
					status: 'pending' as const,
					thumbnail: thumbnails?.get(file.name),
				};
			});
			return [...items, ...newItems];
		});
		return ids;
	}

	function updateItem(id: string, changes: Partial<UploadItem>) {
		update(items => items.map(item => 
			item.id === id ? { ...item, ...changes } : item
		));
	}

	function removeItem(id: string) {
		update(items => items.filter(item => item.id !== id));
	}

	function clear() {
		set([]);
	}

	function clearCompleted() {
		update(items => items.filter(item => item.status !== 'done'));
	}

	return {
		subscribe,
		addFiles,
		updateItem,
		removeItem,
		clear,
		clearCompleted,
	};
}

export const uploadQueue = createUploadStore();

// Derived stores
export const uploading = derived(uploadQueue, $q => $q.some(i => i.status === 'uploading' || i.status === 'compressing'));
export const uploadProgress = derived(uploadQueue, $q => {
	const active = $q.filter(i => i.status !== 'pending');
	if (active.length === 0) return 0;
	return Math.round(active.reduce((sum, i) => sum + i.progress, 0) / active.length);
});

// ============================================
// Upload Functions
// ============================================

const API_BASE = '/api';

/**
 * Upload a single file with progress tracking via XMLHttpRequest.
 */
export function uploadFile(
	item: UploadItem,
	endpoint: string,
	extraFields?: Record<string, string>,
	onProgress?: (percent: number) => void
): Promise<Document> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const formData = new FormData();

		formData.append('file', item.file);
		if (extraFields) {
			Object.entries(extraFields).forEach(([key, val]) => {
				formData.append(key, val);
			});
		}

		xhr.upload.addEventListener('progress', (e) => {
			if (e.lengthComputable) {
				const percent = Math.round((e.loaded / e.total) * 100);
				onProgress?.(percent);
			}
		});

		xhr.addEventListener('load', () => {
			try {
				const response = JSON.parse(xhr.responseText);
				if (xhr.status >= 200 && xhr.status < 300 && response.success) {
					resolve(response.data);
				} else {
					reject(new Error(response.error || response.message || `Upload failed (${xhr.status})`));
				}
			} catch {
				reject(new Error('Invalid server response'));
			}
		});

		xhr.addEventListener('error', () => reject(new Error('Network error')));
		xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

		xhr.open('POST', `${API_BASE}${endpoint}`);
		const token = getAccessToken();
		if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
		xhr.send(formData);
	});
}

/**
 * Upload multiple files sequentially with progress updates.
 */
export async function uploadFiles(
	items: UploadItem[],
	endpoint: string,
	extraFields?: Record<string, string>
): Promise<Document[]> {
	const results: Document[] = [];

	for (const item of items) {
		uploadQueue.updateItem(item.id, { status: 'uploading', progress: 0 });

		try {
			const doc = await uploadFile(item, endpoint, extraFields, (percent) => {
				uploadQueue.updateItem(item.id, { progress: percent });
			});
			uploadQueue.updateItem(item.id, { status: 'done', progress: 100, result: doc });
			results.push(doc);
		} catch (err) {
			const error = err instanceof Error ? err.message : 'Upload failed';
			uploadQueue.updateItem(item.id, { status: 'error', error });
		}
	}

	return results;
}

// ============================================
// Document Sharing API
// ============================================

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const token = getAccessToken();
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};

	const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
	return data.data ?? data;
}

export const sharingApi = {
	async createShareLink(documentId: number, config: ShareLinkConfig): Promise<ShareLink> {
		const body: Record<string, unknown> = {
			permission: config.permission,
			notifyOnAccess: config.notifyOnAccess ?? false,
		};

		if (config.expiresIn) {
			const expires = new Date();
			expires.setHours(expires.getHours() + config.expiresIn);
			body.expiresAt = expires.toISOString();
		}
		if (config.password) body.password = config.password;
		if (config.maxDownloads) body.maxDownloads = config.maxDownloads;
		if (config.recipientEmail) body.recipientEmail = config.recipientEmail;
		if (config.recipientName) body.recipientName = config.recipientName;
		if (config.message) body.message = config.message;

		const result = await apiRequest<ShareLink>(`/documents/${documentId}/share`, {
			method: 'POST',
			body: JSON.stringify(body),
		});

		// Build full URL
		const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
		return {
			...result,
			url: `${baseUrl}/shared/${result.shareToken}`,
		};
	},

	async getShareLinks(documentId: number): Promise<ShareLink[]> {
		return apiRequest(`/documents/${documentId}/shares`);
	},

	async revokeShareLink(shareId: number): Promise<void> {
		await apiRequest(`/documents/shares/${shareId}/revoke`, { method: 'POST' });
	},
};
