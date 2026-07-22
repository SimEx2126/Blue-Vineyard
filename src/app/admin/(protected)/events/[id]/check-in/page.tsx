import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertCanEditEvent } from "@/lib/access";
import { normaliseReference } from "@/lib/reference";

export const dynamic = "force-dynamic";

// Look up a ticket by the number read off the attendee's confirmation and mark
// them arrived. Scoped to this event, gated to editors, then POST→redirect→GET
// so a refresh never re-runs the check-in.
async function checkInByReference(formData: FormData) {
  "use server";
  const eventId = Number(formData.get("eventId"));
  await assertCanEditEvent(eventId);

  const base = `/admin/events/${eventId}/check-in`;
  const reference = normaliseReference(String(formData.get("reference") ?? ""));
  if (!reference) redirect(`${base}?status=nomatch`);

  const registration = await db.query.registrations.findFirst({
    where: and(
      eq(schema.registrations.reference, reference),
      eq(schema.registrations.eventId, eventId)
    ),
    columns: { id: true, checkedInAt: true },
  });
  if (!registration) redirect(`${base}?status=nomatch`);

  if (registration.checkedInAt) {
    redirect(`${base}?status=dup&ref=${reference}`);
  }

  await db
    .update(schema.registrations)
    .set({ checkedInAt: new Date() })
    .where(eq(schema.registrations.id, registration.id));
  redirect(`${base}?status=ok&ref=${reference}`);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; ref?: string }>;
}) {
  const { id } = await params;
  const { status, ref } = await searchParams;
  const eventId = Number(id);
  // Only editors run the door — viewers/assistants can't check people in.
  const { event } = await assertCanEditEvent(eventId);

  const all = await db.query.registrations.findMany({
    where: eq(schema.registrations.eventId, eventId),
    columns: { id: true },
  });
  const arrived = await db.query.registrations.findMany({
    where: and(
      eq(schema.registrations.eventId, eventId),
      isNotNull(schema.registrations.checkedInAt)
    ),
    columns: { id: true },
  });

  // The registrant behind the last scan, so the result banner can name them.
  const last =
    ref != null
      ? await db.query.registrations.findFirst({
          where: and(
            eq(schema.registrations.reference, ref),
            eq(schema.registrations.eventId, eventId)
          ),
          columns: { contactName: true, reference: true, checkedInAt: true },
        })
      : null;

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/admin/events/${eventId}/registrations`}
        className="text-sm text-teal-700 hover:underline"
      >
        ← All registrations
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Door check-in</h1>
        <span className="text-sm font-medium text-zinc-500">
          <span className="text-teal-700">{arrived.length}</span> of {all.length} checked in
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">{event.title}</p>

      {/* Result of the last check-in, in the attendee's colour of news. */}
      {status === "ok" && last && (
        <div className="mt-5 rounded-xl border border-teal-300 bg-teal-50 p-4">
          <p className="text-lg font-semibold text-teal-900">✓ Checked in</p>
          <p className="mt-0.5 text-teal-800">
            {last.contactName} · <span className="font-mono">{last.reference}</span>
          </p>
        </div>
      )}
      {status === "dup" && last && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-lg font-semibold text-amber-900">Already checked in</p>
          <p className="mt-0.5 text-amber-800">
            {last.contactName}
            {last.checkedInAt ? ` · arrived ${formatTime(last.checkedInAt)}` : ""}
          </p>
        </div>
      )}
      {status === "nomatch" && (
        <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="text-lg font-semibold text-red-900">No matching ticket</p>
          <p className="mt-0.5 text-red-800">
            That ticket number isn&rsquo;t registered for this event. Check the number and try again.
          </p>
        </div>
      )}

      <form action={checkInByReference} className="mt-6">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="block text-sm font-medium text-zinc-700" htmlFor="reference">
          Ticket number
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="reference"
            name="reference"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCD-EFGH"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-center font-mono text-lg tracking-widest uppercase shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
          <button className="shrink-0 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">
            Check in
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Type the number from the attendee&rsquo;s confirmation. Dashes and case don&rsquo;t matter.
        </p>
      </form>
    </div>
  );
}
