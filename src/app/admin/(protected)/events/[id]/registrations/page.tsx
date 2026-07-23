import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatCents } from "@/lib/pricing";
import { assertCanViewEvent } from "@/lib/access";
import { getReviewSummary, isEventOver } from "@/lib/review";
import { setCheckIn, sendReviewInvites } from "../../../actions";

export const dynamic = "force-dynamic";

// The check-in pill doubles as its own undo: green when arrived (submitting
// clears it), an outline "Check in" when not. Read-only viewers see a plain
// label instead of a button.
function CheckInControl({
  registrationId,
  checkedIn,
  canEdit,
}: {
  registrationId: number;
  checkedIn: boolean;
  canEdit: boolean;
}) {
  if (!canEdit) {
    return checkedIn ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
        ✓ Arrived
      </span>
    ) : (
      <span className="text-xs text-zinc-400">—</span>
    );
  }
  return (
    <form action={setCheckIn.bind(null, registrationId, !checkedIn)}>
      {checkedIn ? (
        <button
          title="Undo check-in"
          className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-200"
        >
          ✓ Arrived
        </button>
      ) : (
        <button className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-teal-600 hover:bg-teal-50 hover:text-teal-700">
          Check in
        </button>
      )}
    </form>
  );
}

export default async function RegistrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; invited?: string; error?: string }>;
}) {
  const { id } = await params;
  const { q, invited, error } = await searchParams;
  const eventId = Number(id);
  const { event, canEdit } = await assertCanViewEvent(eventId);
  const eventOver = isEventOver(event);
  const reviews = await getReviewSummary(eventId);

  let registrations = await db.query.registrations.findMany({
    where: eq(schema.registrations.eventId, eventId),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });
  if (q) {
    const needle = q.toLowerCase();
    // Searching by ticket reference is how the door desk looks someone up.
    const refNeedle = needle.replace(/[^0-9a-z]/g, "");
    registrations = registrations.filter(
      (r) =>
        r.contactName.toLowerCase().includes(needle) ||
        r.contactEmail.toLowerCase().includes(needle) ||
        (refNeedle.length > 0 &&
          (r.reference ?? "").toLowerCase().replace("-", "").includes(refNeedle))
    );
  }

  const paymentRows = registrations.length
    ? await db.query.payments.findMany({
        where: inArray(
          schema.payments.registrationId,
          registrations.map((r) => r.id)
        ),
      })
    : [];
  const paymentByReg = new Map<number, string>();
  for (const p of paymentRows) {
    if (p.kind !== "charge") continue;
    const existing = paymentByReg.get(p.registrationId);
    if (!existing || p.status === "paid" || p.status === "refunded") {
      paymentByReg.set(p.registrationId, p.status);
    }
  }

  const confirmed = registrations.filter((r) => r.status === "confirmed").length;
  const arrived = registrations.filter((r) => r.checkedInAt).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {confirmed} confirmed
            {event.capacity != null && ` of ${event.capacity}`} · {arrived} checked in ·{" "}
            {registrations.length} total
            {reviews.count > 0 && reviews.average != null && (
              <>
                {" · "}
                <span className="text-amber-500">★</span>{" "}
                <span className="font-medium text-zinc-700">{reviews.average.toFixed(1)}</span> avg (
                {reviews.count} {reviews.count === 1 ? "review" : "reviews"})
              </>
            )}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <form className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name, email or ticket no."
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:flex-none"
            />
            <button className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
              Search
            </button>
          </form>
          {canEdit && (
            <Link
              href={`/admin/events/${eventId}/check-in`}
              className="shrink-0 rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              Door check-in
            </Link>
          )}
          {/* Reviews open once the event is over: read them, and email invites. */}
          {eventOver && (
            <Link
              href={`/admin/events/${eventId}/reviews`}
              className="shrink-0 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Reviews{reviews.count > 0 ? ` (${reviews.count})` : ""}
            </Link>
          )}
          {canEdit && eventOver && (
            <form action={sendReviewInvites.bind(null, eventId)}>
              <button className="shrink-0 rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50">
                Send review invites
              </button>
            </form>
          )}
          <a
            href={`/admin/events/${eventId}/registrations/export`}
            className="shrink-0 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Export CSV
          </a>
        </div>
      </div>

      {invited != null && (
        <p className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          {invited === "0"
            ? "Everyone confirmed has already been invited to review."
            : `Sent ${invited} review ${invited === "1" ? "invite" : "invites"}.`}
        </p>
      )}
      {error === "not-over" && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Review invites can only be sent once the event has finished.
        </p>
      )}

      {/* Cards on phones — this is the screen an organiser opens at the door to
          look someone up, so the ticket number, status and check-in must be
          reachable. */}
      <div className="mt-6 space-y-3 sm:hidden">
        {registrations.map((r) => (
          <div
            key={r.id}
            className={`rounded-xl border p-4 ${
              r.checkedInAt
                ? "border-teal-300 bg-teal-50/60"
                : r.readAt
                  ? "border-zinc-200 bg-white"
                  : "border-teal-200 bg-teal-50/40"
            }`}
          >
            <Link href={`/admin/events/${eventId}/registrations/${r.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.contactName}
                    {!r.readAt && (
                      <span className="ml-2 rounded-full bg-teal-700 px-1.5 text-[10px] font-semibold text-white">
                        new
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-zinc-500">{r.contactEmail}</p>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold text-zinc-700">
                  {r.reference}
                </span>
              </div>
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 text-sm">
              <span>{r.status}</span>
              <span className="text-zinc-500">
                {paymentByReg.get(r.id) ?? (r.amountCents === 0 ? "free" : "—")}
              </span>
              <span className="font-medium">{formatCents(r.amountCents)}</span>
              <span className="ml-auto">
                <CheckInControl
                  registrationId={r.id}
                  checkedIn={Boolean(r.checkedInAt)}
                  canEdit={canEdit}
                />
              </span>
            </div>
          </div>
        ))}
        {registrations.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No registrations{q ? " matching your search" : " yet"}.
          </p>
        )}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Ticket no.</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Arrived</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {registrations.map((r) => (
              <tr key={r.id} className={r.readAt ? "" : "bg-teal-50/40 font-medium"}>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {r.reference ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/events/${eventId}/registrations/${r.id}`}
                    className="hover:underline"
                  >
                    {r.contactName}
                  </Link>
                  {!r.readAt && (
                    <span className="ml-2 rounded-full bg-teal-700 px-1.5 text-[10px] font-semibold text-white">
                      new
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">{r.contactEmail}</td>
                <td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3 text-right">{formatCents(r.amountCents)}</td>
                <td className="px-4 py-3 capitalize text-zinc-500">
                  {paymentByReg.get(r.id) ?? (r.amountCents === 0 ? "free" : "—")}
                </td>
                <td className="px-4 py-3">
                  <CheckInControl
                    registrationId={r.id}
                    checkedIn={Boolean(r.checkedInAt)}
                    canEdit={canEdit}
                  />
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {r.createdAt.toLocaleDateString("en-AU")}
                </td>
              </tr>
            ))}
            {registrations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No registrations{q ? " matching your search" : " yet"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
