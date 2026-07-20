import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertCanEditEvent } from "@/lib/access";
import { publicEventUrl, qrSvg } from "@/lib/qr";
import { SharePanel } from "@/components/SharePanel";
import { BannerField } from "@/components/BannerField";
import { formatCents } from "@/lib/pricing";
import { SECTION_KINDS, SECTION_LABELS, type SectionKind } from "@/lib/sections";
import {
  addAddOn,
  addCoupon,
  addSection,
  addTier,
  deleteAddOn,
  deleteCoupon,
  deleteEvent,
  deleteSection,
  deleteTier,
  updateEvent,
  updateSection,
} from "../../../actions";
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
  const { event } = await assertCanEditEvent(eventId);

  const [sections, tiers, addOns, coupons] = await Promise.all([
    db.query.eventSections.findMany({
      where: eq(schema.eventSections.eventId, eventId),
      orderBy: (s, { asc }) => [asc(s.position), asc(s.id)],
    }),
    db.query.priceTiers.findMany({
      where: eq(schema.priceTiers.eventId, eventId),
      orderBy: (t, { asc }) => [asc(t.position), asc(t.id)],
    }),
    db.query.addOns.findMany({
      where: eq(schema.addOns.eventId, eventId),
      orderBy: (a, { asc }) => [asc(a.position), asc(a.id)],
    }),
    db.query.coupons.findMany({ where: eq(schema.coupons.eventId, eventId) }),
  ]);

  const shareUrl = publicEventUrl(event.slug);
  const qrMarkup = await qrSvg(shareUrl);

  return (
    <div className="max-w-3xl space-y-10">
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

      {/* Details on the left, banner alongside on the right. */}
      <form
        action={updateEvent.bind(null, eventId)}
        className="lg:grid lg:grid-cols-[1fr_18rem] lg:items-start lg:gap-6"
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

      {/* Sections */}
      <section>
        <h2 className="text-lg font-semibold">Form sections</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The registration form is assembled from these sections, in order.
        </p>
        <div className="mt-4 space-y-4">
          {sections.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {SECTION_LABELS[s.kind as SectionKind] ?? s.kind}
                  <span className="ml-2 font-normal text-zinc-400">#{s.id}</span>
                </h3>
                <form action={deleteSection.bind(null, eventId, s.id)}>
                  <button className={dangerBtn}>Remove</button>
                </form>
              </div>
              <form action={updateSection.bind(null, eventId, s.id)} className="mt-3">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    Position
                    <input
                      type="number"
                      name="position"
                      defaultValue={s.position}
                      className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="required" defaultChecked={s.required} />
                    Required
                  </label>
                </div>
                <label className="mt-3 block text-xs font-medium text-zinc-500">
                  Configuration (JSON)
                  <textarea
                    name="config"
                    rows={4}
                    defaultValue={JSON.stringify(s.config, null, 2)}
                    className={input + " font-mono text-xs"}
                  />
                </label>
                <button className={smallBtn + " mt-2"}>Save section</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addSection.bind(null, eventId)} className="mt-4 flex items-center gap-2">
          <select name="kind" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            {SECTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {SECTION_LABELS[k]}
              </option>
            ))}
          </select>
          <button className={smallBtn}>Add section</button>
        </form>
      </section>

      {/* Pricing */}
      <section>
        <h2 className="text-lg font-semibold">Registration options</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Mutually-exclusive options (early bird, standard, day passes). Leave dates blank for
          always-available options.
        </p>
        <div className="mt-4 space-y-2">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm"
            >
              <span>
                <strong>{t.label}</strong> — {formatCents(t.amountCents)}
                {t.availableFrom && ` · from ${t.availableFrom.toLocaleDateString("en-AU")}`}
                {t.availableUntil && ` · until ${t.availableUntil.toLocaleDateString("en-AU")}`}
              </span>
              <form action={deleteTier.bind(null, eventId, t.id)}>
                <button className={dangerBtn}>Delete</button>
              </form>
            </div>
          ))}
        </div>
        <form
          action={addTier.bind(null, eventId)}
          className="mt-3 grid gap-2 rounded-lg border border-dashed border-zinc-300 p-3 sm:grid-cols-5"
        >
          <input name="label" placeholder="Label" required className={input + " mt-0 sm:col-span-2"} />
          <input name="amount" type="number" step="0.01" min="0" placeholder="Price $" required className={input + " mt-0"} />
          <input name="availableFrom" type="datetime-local" className={input + " mt-0"} />
          <input name="availableUntil" type="datetime-local" className={input + " mt-0"} />
          <button className={smallBtn + " sm:col-span-5 sm:justify-self-start"}>Add option</button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Add-ons</h2>
        <div className="mt-4 space-y-2">
          {addOns.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm"
            >
              <span>
                <strong>{a.label}</strong> — {formatCents(a.amountCents)}
              </span>
              <form action={deleteAddOn.bind(null, eventId, a.id)}>
                <button className={dangerBtn}>Delete</button>
              </form>
            </div>
          ))}
        </div>
        <form
          action={addAddOn.bind(null, eventId)}
          className="mt-3 flex flex-wrap gap-2 rounded-lg border border-dashed border-zinc-300 p-3"
        >
          <input name="label" placeholder="Label" required className={input + " mt-0 flex-1"} />
          <input name="amount" type="number" step="0.01" min="0" placeholder="Price $" required className={input + " mt-0 w-28"} />
          <button className={smallBtn}>Add add-on</button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Coupons</h2>
        <div className="mt-4 space-y-2">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm"
            >
              <span>
                <strong>{c.code}</strong> —{" "}
                {c.type === "percent" ? `${c.value}% off` : `${formatCents(c.value)} off`} · used{" "}
                {c.uses}
                {c.maxUses != null ? `/${c.maxUses}` : ""}
              </span>
              <form action={deleteCoupon.bind(null, eventId, c.id)}>
                <button className={dangerBtn}>Delete</button>
              </form>
            </div>
          ))}
        </div>
        <form
          action={addCoupon.bind(null, eventId)}
          className="mt-3 flex flex-wrap gap-2 rounded-lg border border-dashed border-zinc-300 p-3"
        >
          <input name="code" placeholder="CODE" required className={input + " mt-0 w-36"} />
          <select name="type" className={input + " mt-0 w-32"}>
            <option value="percent">% off</option>
            <option value="fixed">$ off</option>
          </select>
          <input name="value" type="number" step="0.01" min="0" placeholder="Value" required className={input + " mt-0 w-28"} />
          <input name="maxUses" type="number" min="1" placeholder="Max uses" className={input + " mt-0 w-28"} />
          <button className={smallBtn}>Add coupon</button>
        </form>
      </section>

      <section className="border-t border-zinc-200 pt-6">
        <form action={deleteEvent.bind(null, eventId)}>
          <button className={dangerBtn}>Delete event</button>
        </form>
      </section>
    </div>
  );
}
