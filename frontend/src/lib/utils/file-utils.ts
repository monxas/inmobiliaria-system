/**
 * File utilities: compression, validation, thumbnails, magic bytes.
 */

// Magic bytes for file type validation
const MAGIC_BYTES: Record<string, number[][]> = {
	'image/jpeg': [[0xff, 0xd8, 0xff]],
	'image/png': [[0x89, 0x50, 0x4e, 0x47]],
	'image/gif': [[0x47, 0x49, 0x46, 0x38]],
	'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
	'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
	'application/zip': [[0x50, 0x4b, 0x03, 0x04]],
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
	valid: boolean;
	error?: string;
}

export interface CompressedImage {
	file: File;
	thumbnail: string; // data URL
	width: number;
	height: number;
	originalSize: number;
	compressedSize: number;
}

/**
 * Validate file using magic bytes (first few bytes of file).
 */
export async function validateMagicBytes(file: File): Promise<boolean> {
	const buffer = await file.slice(0, 8).arrayBuffer();
	const bytes = new Uint8Array(buffer);
	
	const signatures = MAGIC_BYTES[file.type];
	if (!signatures) return true; // No signature to check, trust MIME type
	
	return signatures.some(sig => 
		sig.every((byte, i) => bytes[i] === byte)
	);
}

/**
 * Validate a file for upload.
 */
export async function validateFile(file: File, options?: {
	maxSize?: number;
	allowedTypes?: string[];
	checkMagicBytes?: boolean;
}): Promise<FileValidationResult> {
	const maxSize = options?.maxSize ?? MAX_FILE_SIZE;
	const allowedTypes = options?.allowedTypes ?? [...IMAGE_TYPES, ...DOCUMENT_TYPES];
	const checkMagic = options?.checkMagicBytes ?? true;

	if (file.size > maxSize) {
		return { valid: false, error: `Archivo demasiado grande (máx. ${formatSize(maxSize)})` };
	}

	if (file.size === 0) {
		return { valid: false, error: 'El archivo está vacío' };
	}

	if (!allowedTypes.includes(file.type)) {
		return { valid: false, error: `Tipo de archivo no permitido: ${file.type || 'desconocido'}` };
	}

	if (checkMagic) {
		const validBytes = await validateMagicBytes(file);
		if (!validBytes) {
			return { valid: false, error: 'El contenido del archivo no coincide con su extensión' };
		}
	}

	return { valid: true };
}

/**
 * Validate image file specifically.
 */
export async function validateImageFile(file: File): Promise<FileValidationResult> {
	return validateFile(file, {
		maxSize: MAX_IMAGE_SIZE,
		allowedTypes: IMAGE_TYPES,
		checkMagicBytes: true,
	});
}

/**
 * Compress an image client-side using Canvas API.
 */
export async function compressImage(
	file: File,
	options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<CompressedImage> {
	const maxWidth = options?.maxWidth ?? 1920;
	const maxHeight = options?.maxHeight ?? 1080;
	const quality = options?.quality ?? 0.85;

	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);

			let { width, height } = img;

			// Scale down if needed
			if (width > maxWidth || height > maxHeight) {
				const ratio = Math.min(maxWidth / width, maxHeight / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Canvas context not available'));
				return;
			}

			ctx.drawImage(img, 0, 0, width, height);

			// Generate thumbnail
			const thumbCanvas = document.createElement('canvas');
			const thumbSize = 200;
			const thumbRatio = Math.min(thumbSize / img.width, thumbSize / img.height);
			thumbCanvas.width = Math.round(img.width * thumbRatio);
			thumbCanvas.height = Math.round(img.height * thumbRatio);
			const thumbCtx = thumbCanvas.getContext('2d')!;
			thumbCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
			const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

			canvas.toBlob(
				(blob) => {
					if (!blob) {
						reject(new Error('Compression failed'));
						return;
					}

					const compressed = new File([blob], file.name, {
						type: 'image/webp',
						lastModified: Date.now(),
					});

					resolve({
						file: compressed,
						thumbnail,
						width,
						height,
						originalSize: file.size,
						compressedSize: compressed.size,
					});
				},
				'image/webp',
				quality
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

/**
 * Generate a thumbnail data URL from a file.
 */
export function generateThumbnail(file: File, size = 200): Promise<string> {
	return new Promise((resolve, reject) => {
		if (!file.type.startsWith('image/')) {
			resolve(getFileIcon(file.type));
			return;
		}

		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);
			const canvas = document.createElement('canvas');
			const ratio = Math.min(size / img.width, size / img.height);
			canvas.width = Math.round(img.width * ratio);
			canvas.height = Math.round(img.height * ratio);
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			resolve(canvas.toDataURL('image/jpeg', 0.7));
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to generate thumbnail'));
		};

		img.src = url;
	});
}

/**
 * Get a placeholder icon SVG data URL for non-image files.
 */
export function getFileIcon(mimeType: string): string {
	const iconMap: Record<string, string> = {
		'application/pdf': '📄',
		'application/msword': '📝',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
		'text/plain': '📃',
		'application/zip': '📦',
	};
	// Return a simple SVG with the emoji
	const emoji = iconMap[mimeType] ?? '📎';
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="40">${emoji}</text></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Format file size for display.
 */
export function formatSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = bytes;
	let i = 0;
	while (size >= 1024 && i < units.length - 1) {
		size /= 1024;
		i++;
	}
	return `${size.toFixed(1)} ${units[i]}`;
}

/**
 * Get file extension from filename.
 */
export function getExtension(filename: string): string {
	return filename.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Check if file type is an image.
 */
export function isImageType(mimeType: string): boolean {
	return IMAGE_TYPES.includes(mimeType);
}

/**
 * Check if file type is a PDF.
 */
export function isPdfType(mimeType: string): boolean {
	return mimeType === 'application/pdf';
}

/**
 * Check if file type is previewable.
 */
export function isPreviewable(mimeType: string): boolean {
	return isImageType(mimeType) || isPdfType(mimeType);
}
