/**
 * @fileoverview Repository for property images with variant support.
 */

import { eq, and, isNull, sql, asc, desc } from 'drizzle-orm'
import { db } from '../database/connection'
import { 
  propertyImagesExtended, 
  type PropertyImageExtended, 
  type CreatePropertyImageExtended,
  type UpdatePropertyImageExtended 
} from '../database/schema/property-images'
import { logger } from '../lib/logger'

export class PropertyImagesRepository {
  /**
   * Create a new property image record.
   */
  async create(data: CreatePropertyImageExtended): Promise<PropertyImageExtended> {
    const [image] = await db
      .insert(propertyImagesExtended)
      .values(data)
      .returning()
    
    logger.debug('Property image created', { id: image.id, propertyId: data.propertyId })
    return image
  }

  /**
   * Create multiple property images in batch.
   */
  async createMany(data: CreatePropertyImageExtended[]): Promise<PropertyImageExtended[]> {
    if (data.length === 0) return []
    
    const images = await db
      .insert(propertyImagesExtended)
      .values(data)
      .returning()
    
    logger.debug('Batch property images created', { count: images.length })
    return images
  }

  /**
   * Find image by ID.
   */
  async findById(id: number): Promise<PropertyImageExtended | null> {
    const [image] = await db
      .select()
      .from(propertyImagesExtended)
      .where(and(
        eq(propertyImagesExtended.id, id),
        isNull(propertyImagesExtended.deletedAt)
      ))
      .limit(1)
    
    return image ?? null
  }

  /**
   * Get all images for a property, ordered by orderIndex.
   */
  async findByProperty(propertyId: number): Promise<PropertyImageExtended[]> {
    return db
      .select()
      .from(propertyImagesExtended)
      .where(and(
        eq(propertyImagesExtended.propertyId, propertyId),
        isNull(propertyImagesExtended.deletedAt)
      ))
      .orderBy(asc(propertyImagesExtended.orderIndex))
  }

  /**
   * Get the primary image for a property.
   */
  async findPrimary(propertyId: number): Promise<PropertyImageExtended | null> {
    const [image] = await db
      .select()
      .from(propertyImagesExtended)
      .where(and(
        eq(propertyImagesExtended.propertyId, propertyId),
        eq(propertyImagesExtended.isPrimary, true),
        isNull(propertyImagesExtended.deletedAt)
      ))
      .limit(1)
    
    return image ?? null
  }

  /**
   * Update an image record.
   */
  async update(id: number, data: UpdatePropertyImageExtended): Promise<PropertyImageExtended> {
    const [updated] = await db
      .update(propertyImagesExtended)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(propertyImagesExtended.id, id))
      .returning()
    
    return updated
  }

  /**
   * Set an image as primary (unsets others for the same property).
   */
  async setPrimary(id: number, propertyId: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Unset all other primary images for this property
      await tx
        .update(propertyImagesExtended)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(
          eq(propertyImagesExtended.propertyId, propertyId),
          isNull(propertyImagesExtended.deletedAt)
        ))
      
      // Set the specified image as primary
      await tx
        .update(propertyImagesExtended)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(propertyImagesExtended.id, id))
    })
  }

  /**
   * Reorder images for a property.
   * @param orderMap - Array of { id, orderIndex } pairs
   */
  async reorder(propertyId: number, orderMap: { id: number; orderIndex: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const { id, orderIndex } of orderMap) {
        await tx
          .update(propertyImagesExtended)
          .set({ orderIndex, updatedAt: new Date() })
          .where(and(
            eq(propertyImagesExtended.id, id),
            eq(propertyImagesExtended.propertyId, propertyId)
          ))
      }
    })
  }

  /**
   * Soft delete an image.
   */
  async softDelete(id: number): Promise<void> {
    await db
      .update(propertyImagesExtended)
      .set({ deletedAt: new Date() })
      .where(eq(propertyImagesExtended.id, id))
  }

  /**
   * Hard delete an image (use with caution).
   */
  async hardDelete(id: number): Promise<void> {
    await db
      .delete(propertyImagesExtended)
      .where(eq(propertyImagesExtended.id, id))
  }

  /**
   * Bulk soft delete images by IDs.
   */
  async bulkSoftDelete(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    
    await db
      .update(propertyImagesExtended)
      .set({ deletedAt: new Date() })
      .where(sql`${propertyImagesExtended.id} = ANY(${ids})`)
  }

  /**
   * Get image count for a property.
   */
  async countByProperty(propertyId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(propertyImagesExtended)
      .where(and(
        eq(propertyImagesExtended.propertyId, propertyId),
        isNull(propertyImagesExtended.deletedAt)
      ))
    
    return result?.count ?? 0
  }

  /**
   * Get the next order index for a property.
   */
  async getNextOrderIndex(propertyId: number): Promise<number> {
    const [result] = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${propertyImagesExtended.orderIndex}), -1) + 1` })
      .from(propertyImagesExtended)
      .where(and(
        eq(propertyImagesExtended.propertyId, propertyId),
        isNull(propertyImagesExtended.deletedAt)
      ))
    
    return result?.maxOrder ?? 0
  }
}

export const propertyImagesRepository = new PropertyImagesRepository()
