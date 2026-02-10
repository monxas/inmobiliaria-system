import { pgTable, serial, varchar, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { users } from './users';
import { properties } from './properties';

// Enums
export const clientPropertyRelationshipEnum = pgEnum('client_property_relationship', ['interested', 'viewing', 'offer_made', 'contracted']);

// Clients
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  notes: text('notes'),
  agentId: integer('agent_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Client-Property relationships
export const clientProperties = pgTable('client_properties', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  relationshipType: clientPropertyRelationshipEnum('relationship_type').notNull().default('interested'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Property Viewings
export const propertyViewings = pgTable('property_viewings', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  agentId: integer('agent_id').references(() => users.id).notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').default(60),
  status: varchar('status', { length: 50 }).default('scheduled'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Types
export type Client = InferSelectModel<typeof clients>;
export type CreateClient = InferInsertModel<typeof clients>;
export type UpdateClient = Partial<Omit<CreateClient, 'id'>>;

export type ClientProperty = InferSelectModel<typeof clientProperties>;
export type CreateClientProperty = InferInsertModel<typeof clientProperties>;

export type PropertyViewing = InferSelectModel<typeof propertyViewings>;
export type CreatePropertyViewing = InferInsertModel<typeof propertyViewings>;
