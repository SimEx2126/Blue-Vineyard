import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema, authSchema } from "@/db";
import { assertCanEditEvent, isAdmin } from "@/lib/access";
import { publicEventUrl, qrSvg } from "@/lib/qr";
import { SharePanel } from "@/components/SharePanel";
import { BannerField } from "@/components/BannerField";
import { formatCents } from "@/lib/pricing";
import { addTier, deleteEvent, deleteTier, setEventAdmin, updateEvent } from "../../../actions";
import { EventFields } from "../../EventFields";

export const dynamic = "force-dynamic";

const input =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const smallBtn =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100";
const dangerBtn =
  "rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const eventId = Number(id);
  const { event, user } = await assertCanEditEvent(eventId);

  const tiers = await db.query.priceTiers.findMany({
    where: eq(schema.priceTiers.eventId, eventId),
    orderBy: (t, { asc }) => [asc(t.position), asc(t.id)],
  });

  // Who runs this event, and (for org admins) who it could be handed to.
  const owner = event.ownerId
    ? await db.query.user.findFirst({ where: eq(authSchema.user.id, event.ownerId) })
    : null;
  const assignable = isAdmin(user)
    ? await db.query.user.findMany({
        where: and(
          eq(authSchema.user.orgId, event.orgId),
          eq(authSchema.user.active, true),
          inArray(authSchema.user.role, ["admin", "organiser"])
        ),
        orderBy: (u, { asc }) => [asc(u.name)],
      })
    : [];

  const shareUrl = publicEventUrl(event.slug);
  const qrMarkup = await qrSvg(shareUrl);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit: {event.title}</h1>
        <Link href={`/e/${event.slug}`} className="text-sm text-teal-700 hover:underline">
          View public page →
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}
      {saved && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Saved.
        </p>
      )}

      {event.status === "published" ? (
        <SharePanel url={shareUrl} qrMarkup={qrMarkup} slug={event.slug} />
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
          <strong className="font-medium text-zinc-700">Sharing</strong> — publish this event to get
          its direct link and QR code. Draft events are not visible to registrants.
        </div>
      )}

      {/* Who runs this event. Org admins assign it; the assignee manages the
          event and its registrations. */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Event admin</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {owner ? (
            <>
              Run by <strong className="font-medium text-zinc-700">{owner.name}</strong>{" "}
              <span className="text-zinc-400">({owner.email})</span>
            </>
          ) : (
            "No one is assigned to this event yet."
          )}
        </p>
        {isAdmin(user) && (
          <form action={setEventAdmin.bind(null, eventId)} className="mt-3 flex flex-wrap gap-2">
            <select
              name="ownerId"
              defaultValue={event.ownerId ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Choose a person…
              </option>
              {assignable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.role}
                </option>
              ))}
            </select>
            <button className={smallBtn}>Assign</button>
            <a
              href="/admin/users?role=admin#add-person"
              className="self-center text-sm text-teal-700 hover:underline"
            >
              Add someone new
            </a>
          </form>
        )}
      </section>

      {/* Details on the left, banner alongside on the right. */}
      <form
        action={updateEvent.bind(null, eventId)}
        className="lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6"
      >
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <EventFields event={event} />
          <button
            type="submit"
            className="mt-6 rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Save event
          </button>
        </div>
        <div className="mt-6 lg:mt-0">
          <BannerField name="heroImageUrl" defaultValue={event.heroImageUrl ?? ""} />
        </div>
      </form>

      {/* Pricing — only when the event charges for registration. */}
      {event.requiresPayment ? (
      <section>
        <h2 className="text-lg font-semibold">Registration options</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Mutually-exclusive options (e.g. Adult, Child, Day pass), each at a fixed price.
        </p>
        <div className="mt-4 space-y-2">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm"
            >
              <span>
                <strong>{t.label}</strong> — {formatCents(t.amountCents)}
              </span>
              <form action={deleteTier.bind(null, eventId, t.id)}>
                <button className={dangerBtn}>Delete</button>
              </form>
            </div>
          ))}
        </div>
        <form
          action={addTier.bind(null, eventId)}
          className="mt-3 grid gap-2 rounded-lg border border-dashed border-zinc-300 p-3 sm:grid-cols-3"
        >
          <input name="label" placeholder="Label" required className={input + " mt-0 sm:col-span-2"} />
          <input name="amount" type="number" step="0.01" min="0" placeholder="Price $" required className={input + " mt-0"} />
          <button className={smallBtn + " sm:col-span-3 sm:justify-self-start"}>Add option</button>
        </form>
      </section>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
          This event is <strong className="font-medium text-zinc-700">free</strong> — turn on
          “Registration requires payment” above to set price options.
        </p>
      )}

      <section className="border-t border-zinc-200 pt-6">
        <form action={deleteEvent.bind(null, eventId)}>
          <button className={dangerBtn}>Delete event</button>
        </form>
      </section>
    </div>
  );
}
