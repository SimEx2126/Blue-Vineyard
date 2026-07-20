import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatCents } from "@/lib/pricing";
import { normaliseReference } from "@/lib/reference";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; event?: string }>;
}) {
  const { ref, event: slugParam } = await searchParams;

  // Look up by the ticket reference — it is random, so it doubles as the
  // capability to view this registration. Sequential ids are never accepted.
  const reference = ref ? normaliseReference(ref) : null;
  const registration = reference
    ? await db.query.registrations.findFirst({
        where: eq(schema.registrations.reference, reference),
      })
    : null;

  const event = registration
    ? await db.query.events.findFirst({ where: eq(schema.events.id, registration.eventId) })
    : slugParam
      ? await db.query.events.findFirst({ where: eq(schema.events.slug, slugParam) })
      : null;

  // A reference that resolves to nothing is a mistyped or stale link — say so
  // rather than showing an empty confirmation, which reads as a real ticket.
  if (ref && !registration) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-amber-900">
            We couldn&apos;t find that registration
          </h1>
          <p className="mt-2 text-sm text-amber-800">
            The registration number <span className="font-mono">{ref}</span> didn&apos;t match any
            booking. Please check the number in your confirmation email, or contact the conference
            office for help.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-lg border border-amber-300 bg-white px-5 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Back to events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-teal-50 px-6 py-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-lg text-white">
            ✓
          </div>
          <h1 className="mt-3 text-xl font-bold text-teal-900">Registration confirmed</h1>
          <p className="mt-1 text-sm text-teal-800">
            {registration
              ? `Thanks ${registration.contactName.split(" ")[0]} — a confirmation email is on its way.`
              : "A confirmation email is on its way."}
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4">
            {event?.heroImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.heroImageUrl}
                alt={`${event.title} banner`}
                className="w-24 shrink-0 rounded-lg border border-zinc-200"
              />
            )}
            <div className="min-w-0">
              <h2 className="font-semibold leading-snug">{event?.title ?? "Your event"}</h2>
              {event?.startsAt && (
                <p className="mt-1 text-sm text-zinc-600">
                  {formatDate(event.startsAt)}
                  {event.endsAt ? ` – ${formatDate(event.endsAt)}` : ""}
                </p>
              )}
              {event?.location && <p className="text-sm text-zinc-600">{event.location}</p>}
            </div>
          </div>

          {registration?.reference && (
            <div className="mt-6 rounded-lg border-2 border-dashed border-teal-700 bg-teal-50/60 px-4 py-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-800">
                Your registration number
              </p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-wider text-teal-900">
                {registration.reference}
              </p>
              <p className="mt-3 text-sm text-teal-800">
                Please present this number at the event entrance.
              </p>
            </div>
          )}

          {registration && (
            <dl className="mt-6 space-y-2 border-t border-zinc-200 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Name</dt>
                <dd className="font-medium">{registration.contactName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Email</dt>
                <dd className="font-medium">{registration.contactEmail}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Amount paid</dt>
                <dd className="font-medium">{formatCents(registration.amountCents)}</dd>
              </div>
            </dl>
          )}

          <p className="mt-6 text-center text-xs text-zinc-500">
            Keep this page or your confirmation email — you can screenshot the number above.
          </p>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="inline-block rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100"
            >
              Back to events
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
