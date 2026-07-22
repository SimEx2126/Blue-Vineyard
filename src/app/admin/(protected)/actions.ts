"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { db, schema, authSchema } from "@/db";
import { assertCanEditEvent, canManageEvents, isAdmin, requireUser } from "@/lib/access";
import { confirmRegistration } from "@/lib/confirm";

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

// The signed-in user's org, falling back to the only org for accounts seeded
// before orgId existed. Never "whichever row comes back first".
async function orgIdFor(user: { orgId: number | null }) {
  if (user.orgId != null) return user.orgId;
  const org = await db.query.orgs.findFirst();
  if (!org) throw new Error("No org configured — run the seed.");
  return org.id;
}

// Turns a title into a URL-safe slug: lowercase, accents stripped, apostrophes
// dropped (so "Women's" → "womens"), everything else collapsed to hyphens.
// Capped short of the 200-char column limit to leave room for a "-2" suffix.
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

// The slug is the event's public URL and is globally unique, so on creation it
// is derived from the title rather than typed. If the base is taken, append
// -2, -3, … until it is free.
async function generateEventSlug(title: string) {
  const base = slugify(title) || "event";
  let candidate = base;
  let n = 1;
  while (
    await db.query.events.findFirst({
      where: eq(schema.events.slug, candidate),
      columns: { id: true },
    })
  ) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
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
    requiresPayment: fd.get("requiresPayment") === "on",
    paymentInstructions: str(fd, "paymentInstructions"),
    // The create form has no status control — new events go straight live.
    // The edit form submits its select, so its value wins there.
    status: str(fd, "status") ?? "published",
  };
}

export async function createEvent(fd: FormData) {
  const user = await requireUser();
  // Viewers are read-only; only admins and organisers create events.
  if (!canManageEvents(user)) notFound();
  const fields = eventFieldsFrom(fd);
  // A "form" is a light event; the kind is fixed at creation, and updateEvent
  // never touches it.
  const kind = str(fd, "kind") === "form" ? "form" : "event";
  if (!fields.title)
    redirect(`/admin/events/new?error=A+title+is+required${kind === "form" ? "&kind=form" : ""}`);
  // Slug is not typed on creation — derive a unique one from the title. This
  // overrides the empty slug from the (now absent) form field.
  const slug = await generateEventSlug(fields.title);
  const [event] = await db
    .insert(schema.events)
    .values({ ...fields, kind, slug, orgId: await orgIdFor(user), ownerId: user.id })
    .returning();
  revalidatePath("/admin/events");
  redirect(`/admin/events/${event.id}/edit`);
}

/**
 * Assign the event's admin — the person who runs this event. Org admins only,
 * and the assignee must be an active organiser or admin of the same
 * organization.
 */
export async function setEventAdmin(eventId: number, fd: FormData) {
  const { event, user } = await assertCanEditEvent(eventId);
  if (!isAdmin(user)) notFound();

  const targetId = str(fd, "ownerId");
  if (!targetId) return;
  const target = await db.query.user.findFirst({ where: eq(authSchema.user.id, targetId) });
  if (
    !target ||
    target.orgId !== event.orgId ||
    target.active === false ||
    !["admin", "organiser"].includes(target.role ?? "")
  ) {
    redirect(`/admin/events/${eventId}/edit?error=That+person+cannot+run+events`);
  }

  await db.update(schema.events).set({ ownerId: target.id }).where(eq(schema.events.id, eventId));
  revalidatePath(`/admin/events/${eventId}/edit`);
  redirect(`/admin/events/${eventId}/edit?saved=1`);
}

export async function updateEvent(eventId: number, fd: FormData) {
  await assertCanEditEvent(eventId);
  const fields = eventFieldsFrom(fd);
  await db.update(schema.events).set(fields).where(eq(schema.events.id, eventId));
  revalidatePath(`/admin/events/${eventId}/edit`);
  redirect(`/admin/events/${eventId}/edit?saved=1`);
}

export async function deleteEvent(eventId: number) {
  await assertCanEditEvent(eventId);
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

// ---- Pricing ----

export async function addTier(eventId: number, fd: FormData) {
  await assertCanEditEvent(eventId);
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
    position: existing.length,
  });
  revalidatePath(`/admin/events/${eventId}/edit`);
}

export async function deleteTier(eventId: number, tierId: number) {
  await assertCanEditEvent(eventId);
  await db
    .delete(schema.priceTiers)
    .where(and(eq(schema.priceTiers.id, tierId), eq(schema.priceTiers.eventId, eventId)));
  revalidatePath(`/admin/events/${eventId}/edit`);
}

// ---- Payments ----

export async function refundPayment(paymentId: number) {
  await requireUser();
  const payment = await db.query.payments.findFirst({
    where: and(
      eq(schema.payments.id, paymentId),
      eq(schema.payments.kind, "charge"),
      eq(schema.payments.status, "paid")
    ),
  });
  if (!payment) return;
  // A payment id alone says nothing about who may refund it. Walk to the
  // owning event and check that, or any organiser could refund and cancel
  // another ministry's registration.
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, payment.registrationId),
    columns: { eventId: true },
  });
  if (!registration) return;
  await assertCanEditEvent(registration.eventId);
  // The money is returned outside the app (bank transfer), so this only records
  // the refund in the ledger and cancels the place.
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
  });
  await db
    .update(schema.registrations)
    .set({ status: "cancelled" })
    .where(eq(schema.registrations.id, payment.registrationId));
  revalidatePath("/admin/payments");
}

// ---- Registrations ----

/**
 * An organiser confirms an outside payment arrived: mark the pending charge
 * paid, confirm the place, and send the confirmation email with the ticket.
 */
export async function markPaymentReceived(registrationId: number) {
  await requireUser();
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    columns: { eventId: true, status: true },
  });
  if (!registration) return;
  await assertCanEditEvent(registration.eventId);
  if (registration.status === "confirmed") return;

  await db
    .update(schema.payments)
    .set({ status: "paid" })
    .where(
      and(
        eq(schema.payments.registrationId, registrationId),
        eq(schema.payments.kind, "charge"),
        eq(schema.payments.status, "pending")
      )
    );
  // Flips the registration to confirmed and emails the ticket + calendar invite.
  await confirmRegistration(registrationId);
  revalidatePath(`/admin/events/${registration.eventId}/registrations/${registrationId}`);
  revalidatePath(`/admin/events/${registration.eventId}/registrations`);
}

export async function markRegistrationRead(registrationId: number) {
  await requireUser();
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    columns: { eventId: true },
  });
  if (!registration) return;
  await assertCanEditEvent(registration.eventId);
  await db
    .update(schema.registrations)
    .set({ readAt: new Date() })
    .where(eq(schema.registrations.id, registrationId));
}

/**
 * Mark a registrant arrived at the door (or undo it). Used by the toggle on the
 * registrations list; the fast door screen has its own reference-based action.
 * Payment status is deliberately not a gate — who is standing at the door is the
 * organiser's call.
 */
export async function setCheckIn(registrationId: number, checkedIn: boolean) {
  await requireUser();
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    columns: { eventId: true },
  });
  if (!registration) return;
  await assertCanEditEvent(registration.eventId);
  await db
    .update(schema.registrations)
    .set({ checkedInAt: checkedIn ? new Date() : null })
    .where(eq(schema.registrations.id, registrationId));
  revalidatePath(`/admin/events/${registration.eventId}/registrations`);
  revalidatePath(`/admin/events/${registration.eventId}/check-in`);
}
