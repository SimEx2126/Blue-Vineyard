import Link from "next/link";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  canManageEvents,
  canViewAllEvents,
  eventListWhere,
  requireUser,
} from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const user = await requireUser();
  const events = await db.query.events.findMany({
    where: eventListWhere(user),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
  });

  // Who has registered, per event — the count links through to the list of
  // registrants and their details.
  const counts = events.length
    ? await db
        .select({
          eventId: schema.registrations.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.registrations)
        .where(inArray(schema.registrations.eventId, events.map((e) => e.id)))
        .groupBy(schema.registrations.eventId)
    : [];
  const countByEvent = new Map(counts.map((c) => [c.eventId, c.count]));

  const canManage = canManageEvents(user);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{canViewAllEvents(user) ? "All events" : "Your events"}</h1>
        {canManage && (
          <Link
            href="/admin/events/new"
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            New event
          </Link>
        )}
      </div>
      {/* Cards on phones; the table below is too wide to fit and was clipping
          its action links. */}
      <div className="mt-6 space-y-3 sm:hidden">
        {events.map((event) => (
          <div key={event.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex gap-3">
              {event.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.heroImageUrl}
                  alt=""
                  className="h-16 w-12 shrink-0 rounded border border-zinc-200 bg-zinc-50 object-contain"
                />
              ) : (
                <div className="h-16 w-12 shrink-0 rounded border border-dashed border-zinc-300" />
              )}
              <div className="min-w-0">
                <Link
                  href={`/admin/events/${event.id}/registrations`}
                  className="font-medium hover:underline"
                >
                  {event.title}
                </Link>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {event.category ?? "—"}
                  {event.startsAt ? ` · ${event.startsAt.toLocaleDateString("en-AU")}` : ""}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-2.5 py-1 text-sm font-medium ${
                    event.status === "published"
                      ? "bg-teal-100 text-teal-800"
                      : event.status === "draft"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {event.status}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 border-t border-zinc-100 pt-3 text-sm">
              <Link href={`/e/${event.slug}`} className="text-zinc-500 hover:underline">
                View
              </Link>
              <Link
                href={`/admin/events/${event.id}/registrations`}
                className="text-zinc-500 hover:underline"
              >
                Registered: {countByEvent.get(event.id) ?? 0}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-base">
          <thead className="bg-zinc-50 text-left text-sm uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-4">Title</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Starts</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {events.map((event) => (
              <tr key={event.id}>
                <td className="px-5 py-4 font-medium">
                  <div className="flex items-center gap-3">
                    {/* Contain rather than crop, so a portrait poster is still
                        recognisable at thumbnail size. */}
                    {event.heroImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.heroImageUrl}
                        alt=""
                        className="h-24 w-20 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-[9px] uppercase tracking-wide text-zinc-400"
                        title="No banner set"
                      >
                        No
                        <br />
                        image
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/admin/events/${event.id}/registrations`}
                        className="text-lg font-semibold hover:underline"
                      >
                        {event.title}
                      </Link>
                      {event.description && (
                        // A shortened preview: the text itself is cut to ~100
                        // characters, and the two-line clamp is the backstop.
                        <p className="mt-1 line-clamp-2 max-w-md text-sm font-normal text-zinc-500">
                          {event.description.length > 100
                            ? `${event.description.slice(0, 100).trimEnd()}…`
                            : event.description}
                        </p>
                      )}
                      <Link
                        href={`/admin/events/${event.id}/registrations`}
                        className="mt-1.5 inline-block text-sm font-semibold text-teal-700 hover:underline"
                      >
                        {countByEvent.get(event.id) ?? 0} registered
                      </Link>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-zinc-500">{event.category ?? "—"}</td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-medium ${
                      event.status === "published"
                        ? "bg-teal-100 text-teal-800"
                        : event.status === "draft"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {event.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-zinc-500">
                  {event.startsAt?.toLocaleDateString("en-AU") ?? "—"}
                </td>
                <td className="space-x-3 px-5 py-4 text-right">
                  <Link href={`/e/${event.slug}`} className="text-zinc-500 hover:underline">
                    View
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}/registrations`}
                    className="text-zinc-500 hover:underline"
                  >
                    Registrations
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
