"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getGateway } from "@/lib/payments";
import {
  parseSectionConfig,
  SECTION_KINDS,
  SECTION_TEMPLATES,
  type SectionKind,
} from "@/lib/sections";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(fd: FormData, key: string) {
  const v = str(fd, key);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function date(fd: FormData, key: string) {
  const v = str(fd, key);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dollarsToCents(fd: FormData, key: string) {
  const n = num(fd, key);
  return n == null ? null : Math.round(n * 100);
}

async function orgId() {
  const org = await db.query.orgs.findFirst();
  if (!org) throw new Error("No org configured — run the seed.");
  return org.id;
}

function eventFieldsFrom(fd: FormData) {
  return {
    slug: str(fd, "slug") ?? "",
    title: str(fd, "title") ?? "",
    category: str(fd, "category"),
    heroImageUrl: str(fd, "heroImageUrl"),
    description: str(fd, "description"),
    location: str(fd, "location"),
    startsAt: date(fd, "startsAt"),
    endsAt: date(fd, "endsAt"),
    opensAt: date(fd, "opensAt"),
    closesAt: date(fd, "closesAt"),
    capacity: num(fd, "capacity"),
    fullMessage: str(fd, "fullMessage"),
    status: str(fd, "status") ?? "draft",
  };
}

export async function createEvent(fd: FormData) {
  await requireAdmin();
  const fields = eventFieldsFrom(fd);
  if (!fields.slug || !fields.title) redirect("/admin/events/new?error=Slug+and+title+are+required");
  const [event] = await db
    .insert(schema.events)
    .values({ ...fields, orgId: await orgId() })
    .returning();
  revalidatePath("/admin/events");
  redirect(`/admin/events/${event.id}/edit`);
}

export async function updateEvent(eventId: number, fd: FormData) {
  await requireAdmin();
  const fields = eventFieldsFrom(fd);
  await db.update(schema.events).set(fields).where(eq(schema.events.id, eventId));
  revalidatePath(`/admin/events/${eventId}/edit`);
  redirect(`/admin/events/${eventId}/edit?saved=1`);
}

export async function deleteEvent(eventId: number) {
  await requireAdmin();
  const regs = await db.query.registrations.findMany({
    where: eq(schema.registrations.eventId, eventId),
    columns: { id: true },
  });
  if (regs.length > 0) {
    redirect(`/admin/events/${eventId}/edit?error=Cannot+delete+an+event+with+registrations`);
  }
  await db.delete(schema.events).where(eq(schema.events.id, eventId));
  revalidatePath("/admin/events");
  redirect("/admin/events");
}

// ---- Sections ----

export async function addSection(eventId: number, fd: FormData) {
  await requireAdmin();
  const kind = str(fd, "kind") as SectionKind | null;
  if (!kind || !SECTION_KINDS.includes(kind)) return;
  const existing = await db.query.eventSections.findMany({
    where: eq(schema.eventSections.eventId, eventId),
  });
  await db.insert(schema.eventSections).values({
    eventId,
    kind,
    position: existing.length,
    required: false,
    config: SECTION_TEMPLATES[kind] as Record<string, unknown>,
  });
  revalidatePath(`/admin/events/${eventId}/edit`);
}

export async function updateSection(eventId: number, sectionId: number, fd: FormData) {
  await requireAdmin();
  const section = await db.query.eventSections.findFirst({
    where: and(eq(schema.eventSections.id, sectionId), eq(schema.eventSections.eventId, eventId)),
  });
  if (!section) return;
  let config: unknown;
  try {
    config = parseSectionConfig(section.kind as SectionKind, JSON.parse(str(fd, "config") ?? "{}"));
  } catch {
    redirect(`/admin/events/${eventId}/edit?error=Section+${sectionId}:+invalid+config+JSON`);
  }
  await db
    .update(schema.eventSections)
    .set({
      required: fd.get("required") === "on",
      position: num(fd, "position") ?? section.position,
      config: config as Record<string, unknown>,
    })
    .where(eq(schema.eventSections.id, sectionId));
  revalidatePath(`/admin/events/${eventId}/edit`);
}

export async function deleteSection(eventId: number, sectionId: number) {
  await requireAdmin();
  await db
    .delete(schema.eventSections)
    .where(and(eq(schema.eventSections.id, sectionId), eq(schema.eventSections.eventId, eventId)));
  revalidatePath(`/admin/events/${eventId}/edit`);
}

// ---- Pricing ----

export async function addTier(eventId: number, fd: FormData) {
  await requireAdmin();
  const label = str(fd, "label");
  const amount = dollarsToCents(fd, "amount");
  if (!label || amount == null) return;
  const existing = await db.query.priceTiers.findMany({
    where: eq(schema.priceTiers.eventId, eventId),
  });
  await db.insert(schema.priceTiers).values({
    eventId,
    label,
    amountCents: amount,
    availableFrom: date(fd, "availableFrom"),
    availableUntil: date(fd, "availableUntil"),
    position: existing.length,
  });
  revalidatePath(`/admin/events/${eventId}/edit`);
}

export async function deleteTier(eventId: number, tierId: number) {
  await requireAdmin();
  await db
    .delete(schema.priceTiers)
    .where(and(eq(schema.priceTiers.id, tierId), eq(schema.priceTiers.eventId, eventId)));
  revalidatePath(`/admin/events/${eventId}/edit`);
}

export async function addAddOn(eventId: number, fd: FormData) {
  await requireAdmin();
  const label = str(fd, "label");
  const amount = dollarsToCents(fd, "amount");
  if (!label || amount == null) return;
  await db.insert(schema.addOns).values({ eventId, label, amountCents: amount });
  revalidatePath(`/admin/events/${eventId}/edit`);
}

export async function deleteAddOn(eventId: number, addOnId: number) {
  await requireAdmin();
  await db
    .delete(schema.addOns)
    .where(and(eq(schema.addOns.id, addOnId), eq(schema.addOns.eventId, eventId)));
  revalidatePath(`/admin/events/${eventId}/edit`);
}

export async function addCoupon(eventId: number, fd: FormData) {
  await requireAdmin();
  const code = str(fd, "code");
  const type = str(fd, "type");
  const value = num(fd, "value");
  if (!code || !type || value == null) return;
  await db.insert(schema.coupons).values({
    eventId,
    code,
    type,
    value: type === "fixed" ? Math.round(value * 100) : Math.round(value),
    maxUses: num(fd, "maxUses"),
  });
  revalidatePath(`/admin/events/${eventId}/edit`);
}

export async function deleteCoupon(eventId: number, couponId: number) {
  await requireAdmin();
  await db
    .delete(schema.coupons)
    .where(and(eq(schema.coupons.id, couponId), eq(schema.coupons.eventId, eventId)));
  revalidatePath(`/admin/events/${eventId}/edit`);
}

// ---- Payments ----

export async function refundPayment(paymentId: number) {
  await requireAdmin();
  const payment = await db.query.payments.findFirst({
    where: and(
      eq(schema.payments.id, paymentId),
      eq(schema.payments.kind, "charge"),
      eq(schema.payments.status, "paid")
    ),
  });
  if (!payment) return;
  const gateway = getGateway();
  const refund = await gateway.refund(payment.gatewayRef ?? "", payment.amountCents);
  await db
    .update(schema.payments)
    .set({ status: "refunded" })
    .where(eq(schema.payments.id, payment.id));
  await db.insert(schema.payments).values({
    orgId: payment.orgId,
    registrationId: payment.registrationId,
    kind: "refund",
    amountCents: -payment.amountCents,
    currency: payment.currency,
    status: "refunded",
    gateway: payment.gateway,
    gatewayRef: refund.gatewayRef,
  });
  await db
    .update(schema.registrations)
    .set({ status: "cancelled" })
    .where(eq(schema.registrations.id, payment.registrationId));
  revalidatePath("/admin/payments");
}

// ---- Registrations ----

export async function markRegistrationRead(registrationId: number) {
  await requireAdmin();
  await db
    .update(schema.registrations)
    .set({ readAt: new Date() })
    .where(eq(schema.registrations.id, registrationId));
}
