import Link from "next/link";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatCents } from "@/lib/pricing";
import { isAdmin, requireUser } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireUser();

  // Organisers see only the events they own; admins see the whole conference.
  const events = await db.query.events.findMany({
    where: isAdmin(user) ? undefined : eq(schema.events.ownerId, user.id),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
  });
  const eventIds = events.map((e) => e.id);

  const counts = eventIds.length
    ? await db
        .select({
          eventId: schema.registrations.eventId,
          confirmed: sql<number>`count(*) filter (where ${schema.registrations.status} = 'confirmed')::int`,
          pending: sql<number>`count(*) filter (where ${schema.registrations.status} = 'pending')::int`,
        })
        .from(schema.registrations)
        .where(inArray(schema.registrations.eventId, eventIds))
        .groupBy(schema.registrations.eventId)
    : [];
  const countByEvent = new Map(counts.map((c) => [c.eventId, c]));

  // Revenue is limited to the same events — an organiser must not see the
  // conference-wide takings.
  const [revenue] = eventIds.length
    ? await db
        .select({
          total: sql<number>`coalesce(sum(${schema.payments.amountCents}) filter (where ${schema.payments.status} in ('paid','refunded')), 0)::int`,
        })
        .from(schema.payments)
        .innerJoin(
          schema.registrations,
          eq(schema.payments.registrationId, schema.registrations.id)
        )
        .where(inArray(schema.registrations.eventId, eventIds))
    : [{ total: 0 }];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">
          {isAdmin(user) ? "All registrations" : "Your registrations"}
        </h1>
        <div className="text-sm text-zinc-500">
          Net revenue: <strong className="text-zinc-900">{formatCents(revenue.total)}</strong>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Confirmed</th>
              <th className="px-4 py-3 text-right">Capacity</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {events.map((event) => {
              const c = countByEvent.get(event.id);
              const confirmed = c?.confirmed ?? 0;
              return (
                <tr key={event.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/events/${event.id}/registrations`}
                      className="hover:underline"
                    >
                      {event.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{event.status}</td>
                  <td className="px-4 py-3 text-right">
                    {confirmed}
                    {c?.pending ? (
                      <span className="text-zinc-400"> (+{c.pending} pending)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {event.capacity != null ? (
                      <span
                        className={confirmed >= event.capacity ? "font-semibold text-red-600" : ""}
                      >
                        {confirmed}/{event.capacity}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="text-teal-700 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No events yet.{" "}
                  <Link href="/admin/events/new" className="text-teal-700 hover:underline">
                    Create one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
