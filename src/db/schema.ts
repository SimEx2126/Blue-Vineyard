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
import { user } from "./auth-schema";

// Every table carries org_id so multi-tenant is a migration, not a rewrite.

// A row here is an Organization — the tenant boundary. Admins, organisers,
// events, registrations and payments all belong to exactly one organization,
// and nothing crosses it except the platform super-admin (orgId null).
export const orgs = pgTable("orgs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color"),
});

// Accounts live in auth-schema.ts, owned by Better Auth (user/session/account).
// The `user` table there carries our extra orgId and role fields.

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id")
    .notNull()
    .references(() => orgs.id),
  // The organiser who created and manages this event. Text, because Better
  // Auth issues string ids rather than serials.
  ownerId: text("owner_id").references(() => user.id),
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
  // How to pay — bank details etc. — shown to registrants after they register,
  // since payment happens outside the app (no card gateway).
  paymentInstructions: text("payment_instructions"),
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
  pricing: jsonb("pricing").notNull().default({}), // { tier, addOns, totalCents }
  amountCents: integer("amount_cents").notNull().default(0),
  // Proof of an outside payment, supplied by the registrant. A private Wasabi
  // key for an uploaded screenshot, and/or a typed reference number.
  proofKey: text("proof_key"),
  proofReference: text("proof_reference"),
  proofSubmittedAt: timestamp("proof_submitted_at", { withTimezone: true }),
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
