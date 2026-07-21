import { and, eq, gt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";

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
  const tiers = await db.query.priceTiers.findMany({
    where: eq(schema.priceTiers.eventId, event.id),
    orderBy: (t, { asc }) => [asc(t.position), asc(t.id)],
  });
  return { event, tiers };
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
