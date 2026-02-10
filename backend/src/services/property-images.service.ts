/**
 * @fileoverview Service for property image management with processing.
 */

import { propertyImagesRepository } from '../repositories/property-images.repository'
import { imageProcessor, type ProcessedImage } from './image-processor.service'
import { 
  type PropertyImageExtended, 
  type CreatePropertyImageExtended,
  type UpdatePropertyImageExtended,
  type ImageVariants 
} from '../database/schema/property-images'
import { NotFoundError, ValidationError } from '../types/errors'
import { logger } from '../lib/logger'
import { unlink } from 'fs/promises'
import path from 'path'

const MAX_IMAGES_PER_PROPERTY = 50
const STORAGE_PATH = process.env['FILE_STORAGE_PATH'] ?? './storage'

export interface UploadedFile {
  buffer: Buffer | ArrayBuffer
  filename: string
  mimeType: string
  size: number
}

export class PropertyImagesService {
  /**
   * Upload and process a single image.
   */
  async uploadImage(
    propertyId: number,
    file: UploadedFile,
    uploadedBy: number,
    options?: { altText?: string; caption?: string; isPrimary?: boolean }
  ): Promise<PropertyImageExtended> {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.mimeType)) {
      throw new ValidationError('mimeType', `Invalid file type. Allowed: ${allowedTypes.join(', ')}`)
    }

    // Check image count limit
    const currentCount = await propertyImagesRepository.countByProperty(propertyId)
    if (currentCount >= MAX_IMAGES_PER_PROPERTY) {
      throw new ValidationError('images', `Maximum ${MAX_IMAGES_PER_PROPERTY} images allowed per property`)
    }

    // Process image and generate variants
    const processed = await imageProcessor.processImage(
      file.buffer,
      file.filename,
      propertyId
    )

    // Get next order index
    const orderIndex = await propertyImagesRepository.getNextOrderIndex(propertyId)

    // Determine if this should be primary (first image is auto-primary)
    const isPrimary = options?.isPrimary ?? currentCount === 0

    // Create database record
    const imageData: CreatePropertyImageExtended = {
      propertyId,
      originalFilename: file.filename,
      filename: processed.original.filename,
      filePath: processed.original.path,
      fileSize: processed.original.size,
      mimeType: processed.original.mimeType,
      variants: processed.variants as unknown as ImageVariants,
      metadata: processed.metadata,
      orderIndex,
      isPrimary,
      altText: options?.altText,
      caption: options?.caption,
      uploadedBy,
    }

    const image = await propertyImagesRepository.create(imageData)

    // If setting as primary, unset others
    if (isPrimary && currentCount > 0) {
      await propertyImagesRepository.setPrimary(image.id, propertyId)
    }

    logger.info('Property image uploaded', {
      imageId: image.id,
      propertyId,
      filename: file.filename,
    })

    return image
  }

  /**
   * Upload multiple images at once.
   */
  async uploadMultiple(
    propertyId: number,
    files: UploadedFile[],
    uploadedBy: number
  ): Promise<PropertyImageExtended[]> {
    const results: PropertyImageExtended[] = []
    const errors: { filename: string; error: string }[] = []

    for (const file of files) {
      try {
        const image = await this.uploadImage(propertyId, file, uploadedBy)
        results.push(image)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ filename: file.filename, error: message })
        logger.warn('Failed to upload image', { filename: file.filename, error: message })
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new ValidationError('files', `All uploads failed: ${errors.map(e => e.filename).join(', ')}`)
    }

    return results
  }

  /**
   * Get all images for a property.
   */
  async getPropertyImages(propertyId: number): Promise<PropertyImageExtended[]> {
    return propertyImagesRepository.findByProperty(propertyId)
  }

  /**
   * Get image by ID.
   */
  async getImage(id: number): Promise<PropertyImageExtended> {
    const image = await propertyImagesRepository.findById(id)
    if (!image) {
      throw new NotFoundError('Image')
    }
    return image
  }

  /**
   * Get primary image for a property.
   */
  async getPrimaryImage(propertyId: number): Promise<PropertyImageExtended | null> {
    return propertyImagesRepository.findPrimary(propertyId)
  }

  /**
   * Update image metadata.
   */
  async updateImage(
    id: number,
    data: Pick<UpdatePropertyImageExtended, 'altText' | 'caption'>
  ): Promise<PropertyImageExtended> {
    await this.getImage(id) // Verify exists
    return propertyImagesRepository.update(id, data)
  }

  /**
   * Set an image as the primary image for its property.
   */
  async setPrimaryImage(id: number): Promise<void> {
    const image = await this.getImage(id)
    await propertyImagesRepository.setPrimary(id, image.propertyId)
    logger.info('Primary image set', { imageId: id, propertyId: image.propertyId })
  }

  /**
   * Reorder images for a property.
   */
  async reorderImages(
    propertyId: number,
    orderMap: { id: number; orderIndex: number }[]
  ): Promise<void> {
    await propertyImagesRepository.reorder(propertyId, orderMap)
    logger.info('Images reordered', { propertyId, count: orderMap.length })
  }

  /**
   * Delete a single image (soft delete + file cleanup).
   */
  async deleteImage(id: number, hardDelete = false): Promise<void> {
    const image = await this.getImage(id)

    if (hardDelete) {
      // Delete physical files
      await this.deleteImageFiles(image)
      await propertyImagesRepository.hardDelete(id)
    } else {
      await propertyImagesRepository.softDelete(id)
    }

    // If this was primary, set next image as primary
    if (image.isPrimary) {
      const remaining = await propertyImagesRepository.findByProperty(image.propertyId)
      if (remaining.length > 0) {
        await propertyImagesRepository.setPrimary(remaining[0].id, image.propertyId)
      }
    }

    logger.info('Image deleted', { imageId: id, hardDelete })
  }

  /**
   * Bulk delete images.
   */
  async bulkDelete(ids: number[], hardDelete = false): Promise<void> {
    if (hardDelete) {
      for (const id of ids) {
        try {
          const image = await propertyImagesRepository.findById(id)
          if (image) {
            await this.deleteImageFiles(image)
            await propertyImagesRepository.hardDelete(id)
          }
        } catch (error) {
          logger.warn('Failed to hard delete image', { id, error })
        }
      }
    } else {
      await propertyImagesRepository.bulkSoftDelete(ids)
    }

    logger.info('Bulk images deleted', { count: ids.length, hardDelete })
  }

  /**
   * Rotate an image and regenerate variants.
   */
  async rotateImage(id: number, degrees: 90 | 180 | 270): Promise<PropertyImageExtended> {
    const image = await this.getImage(id)
    
    await imageProcessor.rotateImage(image.filePath, degrees)
    
    // Re-process to regenerate variants
    const fileBuffer = await Bun.file(path.join(STORAGE_PATH, image.filePath)).arrayBuffer()
    const processed = await imageProcessor.processImage(
      fileBuffer,
      image.originalFilename,
      image.propertyId
    )

    // Update database record
    return propertyImagesRepository.update(id, {
      variants: processed.variants as unknown as ImageVariants,
      metadata: processed.metadata,
    })
  }

  /**
   * Delete physical image files.
   */
  private async deleteImageFiles(image: PropertyImageExtended): Promise<void> {
    // Delete original
    try {
      await unlink(path.join(STORAGE_PATH, image.filePath))
    } catch {
      // Ignore if already deleted
    }

    // Delete variants
    if (image.variants) {
      for (const variant of Object.values(image.variants)) {
        try {
          await unlink(path.join(STORAGE_PATH, variant.path))
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Get image statistics for a property.
   */
  async getImageStats(propertyId: number): Promise<{
    count: number
    totalSize: number
    hasPrimary: boolean
  }> {
    const images = await this.getPropertyImages(propertyId)
    const totalSize = images.reduce((sum, img) => sum + img.fileSize, 0)
    const hasPrimary = images.some(img => img.isPrimary)

    return { count: images.length, totalSize, hasPrimary }
  }
}

export const propertyImagesService = new PropertyImagesService()
