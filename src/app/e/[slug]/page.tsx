import Link from "next/link";
import { notFound } from "next/navigation";
import { countActiveRegistrations, getOpenState, getPublicEvent } from "@/lib/registration";
import { getCurrentUser, isAdmin, isSuperAdmin } from "@/lib/access";
import { publicEventUrl, qrSvg } from "@/lib/qr";
import { RegistrationForm } from "@/components/RegistrationForm";
import { ShareQrButton } from "@/components/ShareQrButton";

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
  const { event, tiers } = data;

  const openState = await getOpenState(event);

  const spotsLeft =
    event.capacity != null ? event.capacity - (await countActiveRegistrations(event.id)) : null;

  // Editing lives on the event's page: a signed-in organiser (own event),
  // org admin or super-admin sees the button; the public never does.
  const viewer = await getCurrentUser();
  const canEdit =
    viewer != null &&
    (isSuperAdmin(viewer) ||
      (viewer.orgId === event.orgId && (isAdmin(viewer) || event.ownerId === viewer.id)));

  // Anyone may share: the QR button carries the event's code and direct link.
  const shareUrl = publicEventUrl(event.slug);
  const qrMarkup = await qrSvg(shareUrl);

  return (
    <article>
      <div className="mb-4 flex items-center justify-end gap-3">
        <ShareQrButton url={shareUrl} qrMarkup={qrMarkup} />
        {canEdit && (
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Edit event
          </Link>
        )}
      </div>
      {/* Top: large banner on the left, event details beside it. The
          registration form sits below, across the full width. */}
      <div
        className={
          event.heroImageUrl
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12"
            : "mx-auto max-w-3xl"
        }
      >
        {event.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.heroImageUrl}
            alt={`${event.title} event banner`}
            className="mx-auto mb-6 w-full max-w-full rounded-xl lg:mb-0"
          />
        )}

        <div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
        {event.featured && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
            ★ Featured
          </span>
        )}
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
        </div>
      </div>

      {/* Registration sits below the banner, held to a readable measure. */}
      <div className="mx-auto mt-12 max-w-3xl border-t border-zinc-200 pt-8">
        {openState.open ? (
          <>
            <h2 className="text-xl font-semibold">Register</h2>
            <RegistrationForm
              eventId={event.id}
              // A free event offers no price options, whatever tiers linger
              // from when it was paid.
              tiers={
                event.requiresPayment
                  ? tiers.map((t) => ({ id: t.id, label: t.label, amountCents: t.amountCents }))
                  : []
              }
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
