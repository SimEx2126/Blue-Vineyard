import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertCanViewEvent } from "@/lib/access";
import { getMedia, isProofKey, isStorageConfigured } from "@/lib/storage";

/**
 * Serves a registrant's uploaded proof screenshot. Private: only the event's
 * organiser (or an admin/viewer) may see it, and only keys inside the proofs
 * prefix are served — never a banner or anything else in the bucket.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const registrationId = Number(id);
  if (!Number.isInteger(registrationId)) return new Response("Not found", { status: 404 });

  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    columns: { eventId: true, proofKey: true },
  });
  if (!registration?.proofKey) return new Response("Not found", { status: 404 });

  // Ownership check — throws/redirects (404) if the caller may not view this event.
  await assertCanViewEvent(registration.eventId);

  if (!isStorageConfigured() || !isProofKey(registration.proofKey)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { bytes, contentType } = await getMedia(registration.proofKey);
    if (!bytes) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        // Private — never store in a shared/CDN cache.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
