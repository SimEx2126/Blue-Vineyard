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
  // Whether registering for this event costs money. When false the event is
  // free: no registration options are offered and no payment leg is created.
  requiresPayment: boolean("requires_payment").notNull().default(false),
  // How to pay — bank details etc. — shown to registrants after they register,
  // since payment happens outside the app (no card gateway).
  paymentInstructions: text("payment_instructions"),
  status: text("status").notNull().default("draft"), // draft | published | archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Mutually-exclusive registration options (e.g. Adult / Child / Day pass),
// each at a fixed price.
export const priceTiers = pgTable("price_tiers", {
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
  // The fixed registration form's fields.
  phone: text("phone"),
  gender: text("gender"), // male | female
  age: integer("age"),
  address: text("address"),
  mediaConsent: boolean("media_consent").notNull().default(false),
  // The parent/guardian is automatically the emergency contact.
  parentName: text("parent_name"),
  parentPhone: text("parent_phone"),
  parentConsent: boolean("parent_consent").notNull().default(false),
  tierId: integer("tier_id").references(() => priceTiers.id),
  pricing: jsonb("pricing").notNull().default({}), // { tier, totalCents }
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
