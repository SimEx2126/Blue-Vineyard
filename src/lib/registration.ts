import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { EventSectionDTO, SectionKind } from "./sections";

// Pending registrations older than this no longer hold a place.
const PENDING_HOLD_MINUTES = 30;

export function activeRegistrationWhere(eventId: number) {
  const holdCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000);
  return and(
    eq(schema.registrations.eventId, eventId),
    or(
      eq(schema.registrations.status, "confirmed"),
      and(eq(schema.registrations.status, "pending"), gt(schema.registrations.createdAt, holdCutoff))
    )
  );
}

export async function countActiveRegistrations(eventId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.registrations)
    .where(activeRegistrationWhere(eventId));
  return row.count;
}

export async function getPublicEvent(slug: string) {
  const event = await db.query.events.findFirst({
    where: and(eq(schema.events.slug, slug), eq(schema.events.status, "published")),
  });
  if (!event) return null;
  const [sections, tiers, addOnRows] = await Promise.all([
    db.query.eventSections.findMany({
      where: eq(schema.eventSections.eventId, event.id),
      orderBy: (s, { asc }) => [asc(s.position), asc(s.id)],
    }),
    db.query.priceTiers.findMany({
      where: eq(schema.priceTiers.eventId, event.id),
      orderBy: (t, { asc }) => [asc(t.position), asc(t.id)],
    }),
    db.query.addOns.findMany({
      where: eq(schema.addOns.eventId, event.id),
      orderBy: (a, { asc }) => [asc(a.position), asc(a.id)],
    }),
  ]);
  return { event, sections, tiers, addOns: addOnRows };
}

export function toSectionDTOs(
  sections: (typeof schema.eventSections.$inferSelect)[]
): EventSectionDTO[] {
  return sections.map((s) => ({
    id: s.id,
    kind: s.kind as SectionKind,
    position: s.position,
    required: s.required,
    config: s.config as EventSectionDTO["config"],
  }));
}

export type EventOpenState =
  | { open: true }
  | { open: false; reason: "not_yet_open" | "closed" | "full"; message: string };

export async function getOpenState(
  event: typeof schema.events.$inferSelect
): Promise<EventOpenState> {
  const now = new Date();
  if (event.opensAt && new Date(event.opensAt) > now) {
    return {
      open: false,
      reason: "not_yet_open",
      message: `Registrations open on ${new Date(event.opensAt).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`,
    };
  }
  if (event.closesAt && new Date(event.closesAt) < now) {
    return { open: false, reason: "closed", message: "Registrations for this event have closed." };
  }
  if (event.capacity != null) {
    const count = await countActiveRegistrations(event.id);
    if (count >= event.capacity) {
      return {
        open: false,
        reason: "full",
        message: event.fullMessage || "This event has reached capacity.",
      };
    }
  }
  return { open: true };
}

// Count selections per choice option across active registrations (JS-side; fine at this scale).
export async function choiceOptionCounts(eventId: number, sectionId: number) {
  const regs = await db
    .select({ answers: schema.registrations.answers })
    .from(schema.registrations)
    .where(activeRegistrationWhere(eventId));
  const counts: Record<string, number> = {};
  for (const reg of regs) {
    const answer = (reg.answers as Record<string, { selected?: string | string[] }>)[
      String(sectionId)
    ];
    if (!answer?.selected) continue;
    const picks = Array.isArray(answer.selected) ? answer.selected : [answer.selected];
    for (const pick of picks) counts[pick] = (counts[pick] ?? 0) + 1;
  }
  return counts;
}

export async function findValidCoupon(eventId: number, code: string) {
  const coupon = await db.query.coupons.findFirst({
    where: and(
      eq(schema.coupons.eventId, eventId),
      sql`lower(${schema.coupons.code}) = ${code.trim().toLowerCase()}`
    ),
  });
  if (!coupon) return { error: "Coupon code not recognised." as string, coupon: null };
  if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) {
    return { error: "This coupon has reached its usage limit.", coupon: null };
  }
  return { error: null, coupon };
}

export async function validateAddOnIds(eventId: number, ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await db.query.addOns.findMany({
    where: and(eq(schema.addOns.eventId, eventId), inArray(schema.addOns.id, ids)),
  });
  if (rows.length !== new Set(ids).size) return null;
  return rows;
}
