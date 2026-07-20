import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Every table carries org_id so multi-tenant is a migration, not a rewrite.

export const orgs = pgTable("orgs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color"),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => orgs.id),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  title: text("title").notNull(),
  category: text("category"),
  heroImageUrl: text("hero_image_url"),
  description: text("description"),
  location: text("location"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  opensAt: timestamp("opens_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  capacity: integer("capacity"),
  fullMessage: text("full_message"),
  status: text("status").notNull().default("draft"), // draft | published | archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventSections = pgTable("event_sections", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // see SectionKind in lib/sections.ts
  position: integer("position").notNull().default(0),
  required: boolean("required").notNull().default(false),
  config: jsonb("config").notNull().default({}),
});

// Mutually-exclusive registration options (early bird / standard / day passes).
export const priceTiers = pgTable("price_tiers", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  availableFrom: timestamp("available_from", { withTimezone: true }),
  availableUntil: timestamp("available_until", { withTimezone: true }),
  position: integer("position").notNull().default(0),
});

// Optional extras (linen pack etc.), checkboxes.
export const addOns = pgTable("add_ons", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  position: integer("position").notNull().default(0),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 60 }).notNull(),
  type: text("type").notNull(), // percent | fixed
  value: integer("value").notNull(), // percent (0-100) or cents
  maxUses: integer("max_uses"),
  uses: integer("uses").notNull().default(0),
});

export const registrations = pgTable("registrations", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => orgs.id),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id),
  // Ticket code the attendee presents at the event entrance.
  reference: varchar("reference", { length: 16 }).unique(),
  status: text("status").notNull().default("pending"), // pending | confirmed | cancelled
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  answers: jsonb("answers").notNull().default({}), // keyed by section id
  tierId: integer("tier_id").references(() => priceTiers.id),
  couponId: integer("coupon_id").references(() => coupons.id),
  pricing: jsonb("pricing").notNull().default({}), // { tier, addOns, coupon, totalCents }
  amountCents: integer("amount_cents").notNull().default(0),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The payment ledger: charges and refunds are separate rows, like the
// transaction list in the platform this replaces.
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => orgs.id),
  registrationId: integer("registration_id")
    .notNull()
    .references(() => registrations.id),
  kind: text("kind").notNull().default("charge"), // charge | refund
  amountCents: integer("amount_cents").notNull(), // negative for refunds
  currency: text("currency").notNull().default("aud"),
  status: text("status").notNull().default("pending"), // pending | paid | refunded | failed
  gateway: text("gateway").notNull(),
  gatewayRef: text("gateway_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
