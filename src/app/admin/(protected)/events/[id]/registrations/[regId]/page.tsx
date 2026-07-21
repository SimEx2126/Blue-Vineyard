import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatCents } from "@/lib/pricing";
import { assertCanViewEvent } from "@/lib/access";
import { markPaymentReceived } from "../../../../actions";

export const dynamic = "force-dynamic";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string; regId: string }>;
}) {
  const { id, regId } = await params;
  const eventId = Number(id);
  const registrationId = Number(regId);
  if (!Number.isInteger(registrationId)) notFound();

  // Gate before reading anything. Viewers may look; only editors flip the
  // read marker.
  const { canEdit } = await assertCanViewEvent(eventId);

  const registration = await db.query.registrations.findFirst({
    where: and(
      eq(schema.registrations.id, registrationId),
      eq(schema.registrations.eventId, eventId)
    ),
  });
  if (!registration) notFound();

  const event = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });

  if (canEdit && !registration.readAt) {
    await db
      .update(schema.registrations)
      .set({ readAt: new Date() })
      .where(eq(schema.registrations.id, registrationId));
  }

  const pricing = registration.pricing as {
    tier: { label: string; amountCents: number } | null;
  };

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/events/${eventId}/registrations`}
        className="text-sm text-teal-700 hover:underline"
      >
        ← All registrations
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">
          {registration.contactName}
          {registration.reference && (
            <span className="ml-3 rounded-md bg-zinc-100 px-2 py-1 font-mono text-sm font-semibold text-zinc-700">
              {registration.reference}
            </span>
          )}
        </h1>
        <span className="text-sm text-zinc-500">
          {event?.title} · #{registration.id} · {registration.status} ·{" "}
          {registration.createdAt.toLocaleString("en-AU")}
        </span>
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Registrant</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-zinc-500">Full name</dt>
              <dd className="font-medium">{registration.contactName}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-zinc-500">Email</dt>
              <dd className="font-medium">{registration.contactEmail}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-zinc-500">Gender</dt>
              <dd className="font-medium capitalize">{registration.gender ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-zinc-500">Age</dt>
              <dd className="font-medium">{registration.age ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:col-span-2 sm:block">
              <dt className="text-zinc-500">Address</dt>
              <dd className="font-medium">{registration.address ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-zinc-500">Parent/guardian phone (emergency contact)</dt>
              <dd className="font-medium">{registration.parentPhone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-zinc-500">Parent consent</dt>
              <dd className="font-medium">{registration.parentConsent ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-zinc-500">Media consent</dt>
              <dd className="font-medium">{registration.mediaConsent ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Pricing</h2>
          <dl className="mt-3 space-y-1 text-sm">
            {pricing.tier && (
              <div className="flex justify-between">
                <dt>{pricing.tier.label}</dt>
                <dd>{formatCents(pricing.tier.amountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{formatCents(registration.amountCents)}</dd>
            </div>
          </dl>
        </div>

        {registration.amountCents > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Payment
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  registration.status === "confirmed"
                    ? "bg-teal-100 text-teal-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {registration.status === "confirmed" ? "Paid" : "Awaiting payment"}
              </span>
            </div>

            {registration.proofSubmittedAt ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-zinc-500">
                  Proof submitted {registration.proofSubmittedAt.toLocaleString("en-AU")}
                </p>
                {registration.proofReference && (
                  <p>
                    <span className="text-zinc-500">Reference: </span>
                    <span className="font-medium">{registration.proofReference}</span>
                  </p>
                )}
                {registration.proofKey && (
                  <a
                    href={`/api/registrations/${registration.id}/proof`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/registrations/${registration.id}/proof`}
                      alt="Proof of payment"
                      className="max-h-64 rounded-lg border border-zinc-200"
                    />
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No proof uploaded yet.</p>
            )}

            {canEdit && registration.status === "pending" && (
              <form action={markPaymentReceived.bind(null, registration.id)} className="mt-4">
                <button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  Mark as paid &amp; confirm
                </button>
                <p className="mt-1 text-xs text-zinc-500">
                  Confirms the place and emails the registrant their ticket.
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
