import { pgTable, serial, varchar, text, timestamp, integer, decimal, boolean, pgEnum, unique } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { users } from './users';
import { properties } from './properties';

// Enums
export const clientStatusEnum = pgEnum('client_status', ['lead', 'contacted', 'qualified', 'negotiating', 'closed', 'lost']);
export const clientSourceEnum = pgEnum('client_source', ['website', 'referral', 'walk_in', 'phone', 'social_media', 'portal', 'advertising', 'other']);
export const contactMethodEnum = pgEnum('contact_method', ['phone', 'email', 'whatsapp', 'in_person']);
export const interestTypeEnum = pgEnum('interest_type', ['buy', 'rent', 'both']);
export const clientPropertyRelationshipEnum = pgEnum('client_property_relationship', ['interested', 'viewing', 'offer_made', 'contracted']);
export const viewingStatusEnum = pgEnum('viewing_status', ['scheduled', 'completed', 'cancelled', 'no_show']);

// Clients
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  notes: text('notes'),
  agentId: integer('agent_id').references(() => users.id),
  
  // CRM Pipeline
  status: clientStatusEnum('status').default('lead'),
  source: clientSourceEnum('source').default('other'),
  leadScore: integer('lead_score').default(0),
  
  // Personal Info
  dni: varchar('dni', { length: 20 }),
  dateOfBirth: timestamp('date_of_birth', { mode: 'string' }),
  nationality: varchar('nationality', { length: 100 }),
  occupation: varchar('occupation', { length: 255 }),
  company: varchar('company', { length: 255 }),
  
  // Contact Preferences
  phoneSecondary: varchar('phone_secondary', { length: 50 }),
  preferredContact: contactMethodEnum('preferred_contact').default('phone'),
  preferredContactTime: varchar('preferred_contact_time', { length: 50 }),
  timezone: varchar('timezone', { length: 50 }).default('Europe/Madrid'),
  language: varchar('language', { length: 10 }).default('es'),
  
  // Property Preferences
  interestType: interestTypeEnum('interest_type').default('buy'),
  budgetMin: decimal('budget_min', { precision: 12, scale: 2 }),
  budgetMax: decimal('budget_max', { precision: 12, scale: 2 }),
  preferredZones: text('preferred_zones'),
  preferredPropertyTypes: text('preferred_property_types'),
  minBedrooms: integer('min_bedrooms'),
  minBathrooms: integer('min_bathrooms'),
  minSurface: integer('min_surface'),
  needsGarage: boolean('needs_garage').default(false),
  needsGarden: boolean('needs_garden').default(false),
  additionalRequirements: text('additional_requirements'),
  
  // Engagement
  lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
  nextFollowupAt: timestamp('next_followup_at', { withTimezone: true }),
  totalViewings: integer('total_viewings').default(0),
  totalContacts: integer('total_contacts').default(0),
  tags: text('tags'),
  
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
}, (table) => [
  unique('uq_client_property').on(table.clientId, table.propertyId),
]);

// Property Viewings
export const propertyViewings = pgTable('property_viewings', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  agentId: integer('agent_id').references(() => users.id).notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').default(60),
  status: viewingStatusEnum('status').notNull().default('scheduled'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Client Interactions (contact history)
export const clientInteractions = pgTable('client_interactions', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  agentId: integer('agent_id').references(() => users.id),
  interactionType: varchar('interaction_type', { length: 50 }).notNull(),
  summary: text('summary').notNull(),
  details: text('details'),
  outcome: varchar('outcome', { length: 100 }),
  durationMinutes: integer('duration_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Client Property Matches (AI-suggested)
export const clientPropertyMatches = pgTable('client_property_matches', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  matchScore: integer('match_score').notNull(),
  matchReasons: text('match_reasons'),
  status: varchar('status', { length: 50 }).default('suggested'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('uq_client_property_match').on(table.clientId, table.propertyId),
]);

// Types
export type Client = InferSelectModel<typeof clients>;
export type CreateClient = InferInsertModel<typeof clients>;
export type UpdateClient = Partial<Omit<CreateClient, 'id'>>;

export type ClientProperty = InferSelectModel<typeof clientProperties>;
export type CreateClientProperty = InferInsertModel<typeof clientProperties>;

export type PropertyViewing = InferSelectModel<typeof propertyViewings>;
export type CreatePropertyViewing = InferInsertModel<typeof propertyViewings>;

export type ClientInteraction = InferSelectModel<typeof clientInteractions>;
export type CreateClientInteraction = InferInsertModel<typeof clientInteractions>;

export type ClientPropertyMatch = InferSelectModel<typeof clientPropertyMatches>;
export type CreateClientPropertyMatch = InferInsertModel<typeof clientPropertyMatches>;
