import { pgTable, serial, varchar, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { properties } from './properties';
import { users } from './users';

/**
 * Image variants stored for each property image.
 */
export interface ImageVariants {
  thumbnail: { path: string; width: number; height: number; size: number }
  medium: { path: string; width: number; height: number; size: number }
  large: { path: string; width: number; height: number; size: number }
  full: { path: string; width: number; height: number; size: number }
}

/**
 * EXIF and image metadata.
 */
export interface ImageMetadata {
  width: number
  height: number
  format: string
  hasAlpha: boolean
  orientation?: number
  exif?: {
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
}

/**
 * Property images with variants and metadata.
 */
export const propertyImagesExtended = pgTable('property_images_v2', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  
  // Original file info
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull().default('image/webp'),
  
  // Generated variants (stored as JSONB for flexibility)
  variants: jsonb('variants').$type<ImageVariants>().notNull(),
  
  // Image metadata
  metadata: jsonb('metadata').$type<ImageMetadata>(),
  
  // Display settings
  orderIndex: integer('order_index').notNull().default(0),
  isPrimary: boolean('is_primary').default(false),
  altText: text('alt_text'),
  caption: text('caption'),
  
  // Upload tracking
  uploadedBy: integer('uploaded_by').references(() => users.id),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Types
export type PropertyImageExtended = InferSelectModel<typeof propertyImagesExtended>;
export type CreatePropertyImageExtended = InferInsertModel<typeof propertyImagesExtended>;
export type UpdatePropertyImageExtended = Partial<Omit<CreatePropertyImageExtended, 'id' | 'propertyId' | 'createdAt'>>;
