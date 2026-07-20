import { notFound } from "next/navigation";
import {
  choiceOptionCounts,
  countActiveRegistrations,
  getOpenState,
  getPublicEvent,
  toSectionDTOs,
} from "@/lib/registration";
import { tierIsActive } from "@/lib/pricing";
import { RegistrationForm } from "@/components/RegistrationForm";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicEvent(slug);
  if (!data) notFound();
  const { event, sections, tiers, addOns } = data;

  const openState = await getOpenState(event);
  const sectionDTOs = toSectionDTOs(sections);
  const now = new Date();

  // Per-option remaining capacity for choice sections
  const choiceCounts: Record<string, Record<string, number>> = {};
  for (const s of sectionDTOs) {
    if (s.kind === "choice") {
      choiceCounts[String(s.id)] = await choiceOptionCounts(event.id, s.id);
    }
  }

  const spotsLeft =
    event.capacity != null ? event.capacity - (await countActiveRegistrations(event.id)) : null;

  return (
    <article>
      {event.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.heroImageUrl}
          alt={event.title}
          className="max-h-[420px] w-full rounded-xl object-cover"
        />
      ) : (
        <div className="rounded-xl bg-gradient-to-br from-teal-700 to-teal-900 p-10">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">{event.title}</h1>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
        {event.category && (
          <span className="text-xs font-medium uppercase tracking-wide text-teal-700">
            {event.category}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1 text-sm text-zinc-600">
        {event.startsAt && (
          <p>
            <strong>When:</strong> {formatDate(event.startsAt)}
            {event.endsAt ? ` – ${formatDate(event.endsAt)}` : ""}
          </p>
        )}
        {event.location && (
          <p>
            <strong>Where:</strong> {event.location}
          </p>
        )}
        {spotsLeft != null && openState.open && (
          <p className="text-teal-700">
            {spotsLeft} {spotsLeft === 1 ? "place" : "places"} remaining
          </p>
        )}
      </div>

      {event.description && (
        <div className="prose prose-zinc mt-6 max-w-none whitespace-pre-line text-zinc-700">
          {event.description}
        </div>
      )}

      <div className="mt-10 border-t border-zinc-200 pt-8">
        {openState.open ? (
          <>
            <h2 className="text-xl font-semibold">Register</h2>
            <RegistrationForm
              eventId={event.id}
              sections={sectionDTOs}
              tiers={tiers.map((t) => ({
                id: t.id,
                label: t.label,
                amountCents: t.amountCents,
                availableFrom: t.availableFrom?.toISOString() ?? null,
                availableUntil: t.availableUntil?.toISOString() ?? null,
                active: tierIsActive(
                  {
                    id: t.id,
                    label: t.label,
                    amountCents: t.amountCents,
                    availableFrom: t.availableFrom?.toISOString() ?? null,
                    availableUntil: t.availableUntil?.toISOString() ?? null,
                  },
                  now
                ),
              }))}
              addOns={addOns.map((a) => ({ id: a.id, label: a.label, amountCents: a.amountCents }))}
              choiceCounts={choiceCounts}
            />
          </>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
            {openState.message}
          </div>
        )}
      </div>
    </article>
  );
}
