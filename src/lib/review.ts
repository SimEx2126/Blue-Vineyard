import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

type EventRow = typeof schema.events.$inferSelect;

/**
 * Whether an event has finished, so its post-event review is open. Falls back
 * through the available dates (endsAt → startsAt → closesAt); a form (kind
 * "form") has no dates and is never "over", so it is never reviewable.
 */
export function isEventOver(event: EventRow, now: Date = new Date()) {
  const end = event.endsAt ?? event.startsAt ?? event.closesAt;
  if (!end) return false;
  return new Date(end) < now;
}

export type ReviewSummary = { count: number; average: number | null };

/** Count and average star rating for one event. average is null with no reviews. */
export async function getReviewSummary(eventId: number): Promise<ReviewSummary> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      average: sql<number | null>`avg(${schema.reviews.rating})::float`,
    })
    .from(schema.reviews)
    .where(eq(schema.reviews.eventId, eventId));
  return { count: row?.count ?? 0, average: row?.average ?? null };
}

/** A registrant's existing review for an event, if they have left one. */
export async function findReviewForRegistration(registrationId: number) {
  return db.query.reviews.findFirst({
    where: and(eq(schema.reviews.registrationId, registrationId)),
  });
}
