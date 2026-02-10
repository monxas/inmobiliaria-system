import { pgTable, serial, varchar, text, timestamp, integer, decimal, boolean, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { users } from './users';

// Enums
export const propertyTypeEnum = pgEnum('property_type', ['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']);
export const propertyStatusEnum = pgEnum('property_status', ['available', 'reserved', 'sold', 'rented', 'off_market']);

// Properties
export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }).default('España'),
  propertyType: propertyTypeEnum('property_type').notNull(),
  status: propertyStatusEnum('status').notNull().default('available'),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  surfaceArea: integer('surface_area'),
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  garage: boolean('garage').default(false),
  garden: boolean('garden').default(false),
  ownerId: integer('owner_id').references(() => users.id),
  agentId: integer('agent_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Property Images
export const propertyImages = pgTable('property_images', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  isPrimary: boolean('is_primary').default(false),
  altText: text('alt_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Property Features
export const propertyFeatures = pgTable('property_features', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  featureKey: varchar('feature_key', { length: 100 }).notNull(),
  featureValue: text('feature_value'),
});

// Types
export type Property = InferSelectModel<typeof properties>;
export type CreateProperty = InferInsertModel<typeof properties>;
export type UpdateProperty = Partial<Omit<CreateProperty, 'id'>>;

export type PropertyImage = InferSelectModel<typeof propertyImages>;
export type CreatePropertyImage = InferInsertModel<typeof propertyImages>;

export type PropertyFeature = InferSelectModel<typeof propertyFeatures>;
export type CreatePropertyFeature = InferInsertModel<typeof propertyFeatures>;
