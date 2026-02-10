/**
 * @fileoverview Image processing service using Sharp for optimization, resizing, and format conversion.
 */

import sharp from 'sharp'
import path from 'path'
import { mkdir, unlink, stat } from 'fs/promises'
import { logger } from '../lib/logger'

export interface ImageVariant {
  name: string
  width: number
  height?: number
  quality: number
  format: 'webp' | 'jpeg' | 'png'
}

export interface ProcessedImage {
  original: {
    path: string
    filename: string
    size: number
    mimeType: string
  }
  variants: {
    [key: string]: {
      path: string
      filename: string
      size: number
      width: number
      height: number
    }
  }
  metadata: ImageMetadata
}

export interface ImageMetadata {
  width: number
  height: number
  format: string
  hasAlpha: boolean
  orientation?: number
  exif?: ExifData
}

export interface ExifData {
  make?: string
  model?: string
  dateTaken?: string
  gpsLatitude?: number
  gpsLongitude?: number
  iso?: number
  fNumber?: number
  exposureTime?: string
  focalLength?: number
}

// Default variants for property images
const DEFAULT_VARIANTS: ImageVariant[] = [
  { name: 'thumbnail', width: 200, height: 150, quality: 80, format: 'webp' },
  { name: 'medium', width: 800, height: 600, quality: 85, format: 'webp' },
  { name: 'large', width: 1600, height: 1200, quality: 90, format: 'webp' },
  { name: 'full', width: 2400, quality: 90, format: 'webp' },
]

export class ImageProcessorService {
  private storagePath: string
  private variants: ImageVariant[]

  constructor(
    storagePath: string = process.env['FILE_STORAGE_PATH'] ?? './storage',
    variants: ImageVariant[] = DEFAULT_VARIANTS
  ) {
    this.storagePath = storagePath
    this.variants = variants
  }

  /**
   * Process an uploaded image: generate all variants and extract metadata.
   */
  async processImage(
    inputBuffer: Buffer | ArrayBuffer,
    originalFilename: string,
    propertyId: number
  ): Promise<ProcessedImage> {
    const buffer = Buffer.isBuffer(inputBuffer) 
      ? inputBuffer 
      : Buffer.from(inputBuffer)
    
    const image = sharp(buffer)
    const metadata = await this.extractMetadata(image, buffer)
    
    // Generate unique base filename
    const ext = path.extname(originalFilename)
    const baseName = path.basename(originalFilename, ext)
    const uniqueId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50)
    
    // Create directory structure: /storage/properties/{propertyId}/images/
    const propertyDir = path.join(this.storagePath, 'properties', String(propertyId), 'images')
    await mkdir(propertyDir, { recursive: true })
    
    // Save original (converted to WebP for storage efficiency)
    const originalFilenameWebp = `${sanitizedName}-${uniqueId}-original.webp`
    const originalPath = path.join(propertyDir, originalFilenameWebp)
    
    await image
      .rotate() // Auto-rotate based on EXIF
      .webp({ quality: 95, effort: 4 })
      .toFile(originalPath)
    
    const originalStats = await stat(originalPath)
    
    // Generate variants
    const variants: ProcessedImage['variants'] = {}
    
    for (const variant of this.variants) {
      const variantResult = await this.generateVariant(
        buffer,
        propertyDir,
        `${sanitizedName}-${uniqueId}`,
        variant,
        metadata
      )
      variants[variant.name] = variantResult
    }
    
    logger.info('Image processed successfully', {
      propertyId,
      originalFilename,
      variants: Object.keys(variants),
      originalSize: buffer.length,
      optimizedSize: originalStats.size,
    })
    
    return {
      original: {
        path: `properties/${propertyId}/images/${originalFilenameWebp}`,
        filename: originalFilenameWebp,
        size: originalStats.size,
        mimeType: 'image/webp',
      },
      variants,
      metadata,
    }
  }

  /**
   * Generate a single image variant.
   */
  private async generateVariant(
    inputBuffer: Buffer,
    outputDir: string,
    baseFilename: string,
    variant: ImageVariant,
    originalMetadata: ImageMetadata
  ): Promise<ProcessedImage['variants'][string]> {
    const filename = `${baseFilename}-${variant.name}.${variant.format}`
    const outputPath = path.join(outputDir, filename)
    
    let resizeOptions: sharp.ResizeOptions = {
      width: variant.width,
      height: variant.height,
      fit: variant.height ? 'cover' : 'inside',
      withoutEnlargement: true,
    }
    
    // Don't upscale if original is smaller
    if (originalMetadata.width < variant.width) {
      resizeOptions.width = originalMetadata.width
    }
    
    let pipeline = sharp(inputBuffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(resizeOptions)
    
    // Apply format-specific optimizations
    switch (variant.format) {
      case 'webp':
        pipeline = pipeline.webp({ quality: variant.quality, effort: 4 })
        break
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: variant.quality, mozjpeg: true })
        break
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9, palette: true })
        break
    }
    
    const result = await pipeline.toFile(outputPath)
    
    return {
      path: path.relative(this.storagePath, outputPath),
      filename,
      size: result.size,
      width: result.width,
      height: result.height,
    }
  }

  /**
   * Extract metadata from an image including EXIF data.
   */
  async extractMetadata(image: sharp.Sharp, buffer: Buffer): Promise<ImageMetadata> {
    const meta = await image.metadata()
    
    let exifData: ExifData | undefined
    
    // Try to extract EXIF data
    if (meta.exif) {
      try {
        const { default: exifReader } = await import('exif-reader')
        const exif = exifReader(meta.exif)
        
        exifData = {
          make: exif.Image?.Make,
          model: exif.Image?.Model,
          dateTaken: exif.Photo?.DateTimeOriginal?.toISOString(),
          iso: exif.Photo?.ISOSpeedRatings?.[0],
          fNumber: exif.Photo?.FNumber,
          exposureTime: exif.Photo?.ExposureTime 
            ? `1/${Math.round(1 / exif.Photo.ExposureTime)}` 
            : undefined,
          focalLength: exif.Photo?.FocalLength,
          gpsLatitude: exif.GPSInfo?.GPSLatitude 
            ? this.parseGpsCoordinate(exif.GPSInfo.GPSLatitude, exif.GPSInfo.GPSLatitudeRef)
            : undefined,
          gpsLongitude: exif.GPSInfo?.GPSLongitude 
            ? this.parseGpsCoordinate(exif.GPSInfo.GPSLongitude, exif.GPSInfo.GPSLongitudeRef)
            : undefined,
        }
      } catch (error) {
        logger.debug('Failed to parse EXIF data', { error })
      }
    }
    
    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      format: meta.format ?? 'unknown',
      hasAlpha: meta.hasAlpha ?? false,
      orientation: meta.orientation,
      exif: exifData,
    }
  }

  /**
   * Parse GPS coordinates from EXIF format.
   */
  private parseGpsCoordinate(
    coord: [number, number, number],
    ref: string
  ): number {
    const degrees = coord[0] + coord[1] / 60 + coord[2] / 3600
    return (ref === 'S' || ref === 'W') ? -degrees : degrees
  }

  /**
   * Crop and resize an image.
   */
  async cropImage(
    inputPath: string,
    outputPath: string,
    options: {
      left: number
      top: number
      width: number
      height: number
      targetWidth?: number
      targetHeight?: number
    }
  ): Promise<void> {
    let pipeline = sharp(path.join(this.storagePath, inputPath))
      .extract({
        left: options.left,
        top: options.top,
        width: options.width,
        height: options.height,
      })
    
    if (options.targetWidth || options.targetHeight) {
      pipeline = pipeline.resize(options.targetWidth, options.targetHeight, { fit: 'cover' })
    }
    
    await pipeline
      .webp({ quality: 90 })
      .toFile(path.join(this.storagePath, outputPath))
  }

  /**
   * Rotate an image by specified degrees.
   */
  async rotateImage(
    inputPath: string,
    degrees: 90 | 180 | 270
  ): Promise<void> {
    const fullPath = path.join(this.storagePath, inputPath)
    const buffer = await Bun.file(fullPath).arrayBuffer()
    
    await sharp(Buffer.from(buffer))
      .rotate(degrees)
      .webp({ quality: 90 })
      .toFile(fullPath)
  }

  /**
   * Delete all variants of an image.
   */
  async deleteImageVariants(propertyId: number, baseFilename: string): Promise<void> {
    const dir = path.join(this.storagePath, 'properties', String(propertyId), 'images')
    
    const variantSuffixes = ['original', ...this.variants.map(v => v.name)]
    
    for (const suffix of variantSuffixes) {
      const filename = `${baseFilename}-${suffix}.webp`
      const filepath = path.join(dir, filename)
      
      try {
        await unlink(filepath)
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  }

  /**
   * Get storage path for a property's images.
   */
  getPropertyImagePath(propertyId: number): string {
    return path.join('properties', String(propertyId), 'images')
  }
}

export const imageProcessor = new ImageProcessorService()
