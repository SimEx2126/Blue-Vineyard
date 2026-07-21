import Link from "next/link";
import { db } from "@/db";
import {
  canManageEvents,
  canViewAllEvents,
  eventListWhere,
  isAdmin,
  requireUser,
} from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const user = await requireUser();
  const events = await db.query.events.findMany({
    where: eventListWhere(user),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
  });

  const canManage = canManageEvents(user);
  const canEditEvent = (e: (typeof events)[number]) => isAdmin(user) || e.ownerId === user.id;

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
                <p className="font-medium">{event.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {event.category ?? "—"}
                  {event.startsAt ? ` · ${event.startsAt.toLocaleDateString("en-AU")}` : ""}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
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
                Registrations
              </Link>
              {canEditEvent(event) && (
                <Link
                  href={`/admin/events/${event.id}/edit`}
                  className="text-teal-700 hover:underline"
                >
                  Edit
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Starts</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {events.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-3">
                    {/* Contain rather than crop, so a portrait poster is still
                        recognisable at thumbnail size. */}
                    {event.heroImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.heroImageUrl}
                        alt=""
                        className="h-14 w-11 shrink-0 rounded border border-zinc-200 bg-zinc-50 object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-14 w-11 shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 text-[9px] uppercase tracking-wide text-zinc-400"
                        title="No banner set"
                      >
                        No
                        <br />
                        image
                      </div>
                    )}
                    <div className="min-w-0">
                      <span>{event.title}</span>
                      {event.description && (
                        // Two lines then ellipsis: enough to tell events apart
                        // without the row growing with the copy.
                        <p className="mt-0.5 line-clamp-2 max-w-md text-xs font-normal text-zinc-500">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{event.category ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
                <td className="px-4 py-3 text-zinc-500">
                  {event.startsAt?.toLocaleDateString("en-AU") ?? "—"}
                </td>
                <td className="space-x-3 px-4 py-3 text-right">
                  <Link href={`/e/${event.slug}`} className="text-zinc-500 hover:underline">
                    View
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}/registrations`}
                    className="text-zinc-500 hover:underline"
                  >
                    Registrations
                  </Link>
                  {canEditEvent(event) && (
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="text-teal-700 hover:underline"
                    >
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
