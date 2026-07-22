import Link from "next/link";
import { inArray, sql } from "drizzle-orm";
import { db, schema, authSchema } from "@/db";
import {
  canManageEvents,
  canViewAllEvents,
  eventListWhere,
  requireUser,
} from "@/lib/access";
import { publicEventUrl, qrSvg } from "@/lib/qr";
import { ShareQrButton } from "@/components/ShareQrButton";

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

  // The assigned admin's name, shown on each card.
  const ownerIds = [...new Set(events.map((e) => e.ownerId).filter((v): v is string => !!v))];
  const owners = ownerIds.length
    ? await db.query.user.findMany({ where: inArray(authSchema.user.id, ownerIds) })
    : [];
  const ownerById = new Map(owners.map((o) => [o.id, o.name]));

  // Each row carries the event's QR + link, ready to share from the list.
  const qrByEvent = new Map(
    await Promise.all(
      events.map(async (e) => [e.id, await qrSvg(publicEventUrl(e.slug))] as const)
    )
  );

  const canManage = canManageEvents(user);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{canViewAllEvents(user) ? "All events" : "Your events"}</h1>
        {canManage && (
          <div className="flex items-center gap-2">
            <Link
              href="/admin/events/new"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              New event
            </Link>
            {/* A standalone registration form — no event needed. */}
            <Link
              href="/admin/events/new?kind=form"
              className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              Create form
            </Link>
          </div>
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
                {event.kind === "form" && (
                  <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                    Form
                  </span>
                )}
                <p className="mt-0.5 text-xs text-zinc-500">
                  {event.kind === "form" ? "" : (event.category ?? "—")}
                  {event.startsAt ? ` · ${event.startsAt.toLocaleDateString("en-AU")}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-3 text-sm">
              <Link href={`/e/${event.slug}`} className="text-zinc-500 hover:underline">
                View
              </Link>
              <Link
                href={`/admin/events/${event.id}/registrations`}
                className="text-zinc-500 hover:underline"
              >
                Registered: {countByEvent.get(event.id) ?? 0}
              </Link>
              <span className="ml-auto">
                <ShareQrButton
                  url={publicEventUrl(event.slug)}
                  qrMarkup={qrByEvent.get(event.id) ?? ""}
                />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* One card per event: banner + details on the left, a stacked meta
          column (status, category, date) in the middle-right, and the actions
          grouped past a divider. */}
      <div className="mt-6 hidden space-y-4 sm:block">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-5"
          >
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

            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/events/${event.id}/registrations`}
                className="text-lg font-semibold hover:underline"
              >
                {event.title}
              </Link>
              {event.kind === "form" && (
                <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 align-middle">
                  Form
                </span>
              )}
              {event.description && (
                // A shortened preview: the text itself is cut to ~100
                // characters, and the two-line clamp is the backstop.
                <p className="mt-1 line-clamp-2 max-w-md text-sm text-zinc-500">
                  {event.description.length > 100
                    ? `${event.description.slice(0, 100).trimEnd()}…`
                    : event.description}
                </p>
              )}
              <Link
                href={`/admin/events/${event.id}/registrations`}
                className="mt-2 inline-block text-sm font-semibold text-teal-700 hover:underline"
              >
                {countByEvent.get(event.id) ?? 0} registered
              </Link>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
              {event.category && <span className="text-sm text-zinc-500">{event.category}</span>}
              {/* A form has no date by design, so no "Date TBC" nag. */}
              {event.kind !== "form" && (
                <span className="text-sm text-zinc-500">
                  {event.startsAt?.toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }) ?? "Date TBC"}
                </span>
              )}
              {event.ownerId && ownerById.get(event.ownerId) && (
                <span className="text-sm text-zinc-500">
                  Admin: <span className="text-zinc-700">{ownerById.get(event.ownerId)}</span>
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3 border-l border-zinc-200 pl-5">
              <ShareQrButton
                url={publicEventUrl(event.slug)}
                qrMarkup={qrByEvent.get(event.id) ?? ""}
              />
              <Link
                href={`/e/${event.slug}`}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
