import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatCents } from "@/lib/pricing";
import { assertCanViewEvent } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const eventId = Number(id);
  const { event } = await assertCanViewEvent(eventId);

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {confirmed} confirmed
            {event.capacity != null && ` of ${event.capacity}`} · {registrations.length} total
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
          <a
            href={`/admin/events/${eventId}/registrations/export`}
            className="shrink-0 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* Cards on phones — this is the screen an organiser opens at the door to
          look someone up, so the ticket number and status must be reachable. */}
      <div className="mt-6 space-y-3 sm:hidden">
        {registrations.map((r) => (
          <Link
            key={r.id}
            href={`/admin/events/${eventId}/registrations/${r.id}`}
            className={`block rounded-xl border p-4 ${
              r.readAt ? "border-zinc-200 bg-white" : "border-teal-200 bg-teal-50/40"
            }`}
          >
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
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-sm">
              <span>{r.status}</span>
              <span className="text-zinc-500">
                {paymentByReg.get(r.id) ?? (r.amountCents === 0 ? "free" : "—")}
              </span>
              <span className="ml-auto font-medium">{formatCents(r.amountCents)}</span>
            </div>
          </Link>
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
                <td className="px-4 py-3 text-zinc-500">
                  {r.createdAt.toLocaleDateString("en-AU")}
                </td>
              </tr>
            ))}
            {registrations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
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
