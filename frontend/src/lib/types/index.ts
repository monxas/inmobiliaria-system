// ============================================
// Entity Types
// ============================================

export interface User {
	id: number;
	email: string;
	fullName: string;
	role: 'admin' | 'agent' | 'client';
	phone?: string | null;
	avatarUrl?: string | null;
	createdAt: string;
	updatedAt?: string | null;
}

export interface Property {
	id: number;
	title: string;
	description?: string | null;
	address: string;
	city: string;
	postalCode?: string | null;
	country: string;
	propertyType: PropertyType;
	status: PropertyStatus;
	price: string;
	surfaceArea?: number | null;
	bedrooms?: number | null;
	bathrooms?: number | null;
	garage: boolean;
	garden: boolean;
	ownerId?: number | null;
	agentId?: number | null;
	createdAt: string;
	updatedAt?: string | null;
}

export interface Client {
	id: number;
	fullName: string;
	email?: string | null;
	phone?: string | null;
	address?: string | null;
	notes?: string | null;
	agentId?: number | null;
	createdAt: string;
	updatedAt?: string | null;
}

export interface Document {
	id: number;
	filename: string;
	originalFilename: string;
	filePath: string;
	fileSize: number;
	mimeType: string;
	category: FileCategory;
	propertyId?: number | null;
	clientId?: number | null;
	accessToken?: string | null;
	expiresAt?: string | null;
	isPublic: boolean;
	uploadedBy: number;
	createdAt: string;
	updatedAt?: string | null;
}

// ============================================
// Enums
// ============================================

export type PropertyType = 'house' | 'apartment' | 'office' | 'warehouse' | 'land' | 'commercial';
export type PropertyStatus = 'available' | 'reserved' | 'sold' | 'rented' | 'off_market';
export type UserRole = 'admin' | 'agent' | 'client';
export type FileCategory = 'property_docs' | 'property_images' | 'client_docs' | 'contracts' | 'other';

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
	{ value: 'house', label: 'Casa' },
	{ value: 'apartment', label: 'Apartamento' },
	{ value: 'office', label: 'Oficina' },
	{ value: 'warehouse', label: 'Almacén' },
	{ value: 'land', label: 'Terreno' },
	{ value: 'commercial', label: 'Comercial' }
];

export const PROPERTY_STATUSES: { value: PropertyStatus; label: string; color: string }[] = [
	{ value: 'available', label: 'Disponible', color: 'bg-green-100 text-green-800' },
	{ value: 'reserved', label: 'Reservado', color: 'bg-yellow-100 text-yellow-800' },
	{ value: 'sold', label: 'Vendido', color: 'bg-blue-100 text-blue-800' },
	{ value: 'rented', label: 'Alquilado', color: 'bg-purple-100 text-purple-800' },
	{ value: 'off_market', label: 'Fuera de mercado', color: 'bg-gray-100 text-gray-800' }
];

export const USER_ROLES: { value: UserRole; label: string }[] = [
	{ value: 'admin', label: 'Administrador' },
	{ value: 'agent', label: 'Agente' },
	{ value: 'client', label: 'Cliente' }
];

export const FILE_CATEGORIES: { value: FileCategory; label: string }[] = [
	{ value: 'property_docs', label: 'Documentos de Propiedad' },
	{ value: 'property_images', label: 'Imágenes de Propiedad' },
	{ value: 'client_docs', label: 'Documentos de Cliente' },
	{ value: 'contracts', label: 'Contratos' },
	{ value: 'other', label: 'Otros' }
];

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface PaginatedResponse<T> {
	success: boolean;
	data: T[];
	pagination: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	};
}

export interface AuthResponse {
	success: boolean;
	data: {
		user: User;
		accessToken: string;
		refreshToken: string;
	};
}

export interface LoginPayload {
	email: string;
	password: string;
}

export interface RegisterPayload {
	email: string;
	password: string;
	fullName: string;
	phone?: string;
}

// ============================================
// Form Input Types
// ============================================

export interface PropertyInput {
	title: string;
	description?: string;
	address: string;
	city: string;
	postalCode?: string;
	country?: string;
	propertyType: PropertyType;
	status?: PropertyStatus;
	price: string | number;
	surfaceArea?: number;
	bedrooms?: number;
	bathrooms?: number;
	garage?: boolean;
	garden?: boolean;
	ownerId?: number;
	agentId?: number;
}

export interface ClientInput {
	fullName: string;
	email?: string;
	phone?: string;
	address?: string;
	notes?: string;
	agentId?: number;
}

export interface UserInput {
	email: string;
	password?: string;
	fullName: string;
	role?: UserRole;
	phone?: string;
	avatarUrl?: string;
}

// ============================================
// Filter Types
// ============================================

export interface PropertyFilters {
	city?: string;
	propertyType?: PropertyType;
	status?: PropertyStatus;
	minPrice?: number;
	maxPrice?: number;
	minBedrooms?: number;
	search?: string;
}

export interface ClientFilters {
	fullName?: string;
	email?: string;
	agentId?: number;
	search?: string;
}

export interface UserFilters {
	email?: string;
	role?: UserRole;
	fullName?: string;
	search?: string;
}

export interface DocumentFilters {
	category?: FileCategory;
	propertyId?: number;
	clientId?: number;
	isPublic?: boolean;
}
