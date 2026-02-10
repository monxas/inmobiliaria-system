import path from 'path'
import { mkdir } from 'fs/promises'
import { ValidationError } from '../types/errors'
import { signJWT, verifyJWT } from './crypto'
import type { FileManagerConfig, FileCategory } from '../types'

const DEFAULT_CONFIG: FileManagerConfig = {
  storagePath: process.env['FILE_STORAGE_PATH'] ?? './storage',
  secretKey: process.env['JWT_SECRET'] ?? 'dev-secret',
  categories: {
    property_images: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
    property_docs: {
      maxSize: 25 * 1024 * 1024, // 25MB
      allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    },
    client_docs: {
      maxSize: 25 * 1024 * 1024, // 25MB
      allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    },
    contracts: {
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: ['application/pdf'],
    },
    other: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    },
  },
}

export class FileManager {
  private config: FileManagerConfig

  constructor(config?: Partial<FileManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async upload(file: File, category: FileCategory): Promise<{ filename: string; filepath: string }> {
    this.validateFile(file, category)

    const ext = path.extname(file.name)
    const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`
    const dir = path.join(this.config.storagePath, category)
    const filepath = path.join(dir, filename)

    await mkdir(dir, { recursive: true })
    const buffer = await file.arrayBuffer()
    await Bun.write(filepath, buffer)

    return { filename, filepath: path.join(category, filename) }
  }

  generateSecureToken(fileId: number, expiresIn: string = '24h'): string {
    return signJWT({ fileId }, expiresIn)
  }

  verifyFileToken(token: string): { fileId: number } | null {
    try {
      return verifyJWT<{ fileId: number }>(token)
    } catch {
      return null
    }
  }

  private validateFile(file: File, category: FileCategory): void {
    const catConfig = this.config.categories[category]
    if (!catConfig) throw new ValidationError('category', `Unknown category: ${category}`)

    if (file.size > catConfig.maxSize) {
      throw new ValidationError('file_size', `File too large (max ${catConfig.maxSize} bytes)`)
    }

    if (!catConfig.allowedTypes.includes(file.type)) {
      throw new ValidationError('mime_type', `Invalid file type: ${file.type}`)
    }
  }
}

export const fileManager = new FileManager()
