import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { normaliseReference } from "@/lib/reference";
import { isEventOver, findReviewForRegistration } from "@/lib/review";
import { StarRating } from "@/components/StarRating";

export const dynamic = "force-dynamic";

// Submit a post-event review. Authorised purely by possession of the ticket
// reference (the random code is the capability), re-checking every gate
// server-side so the client can't submit for an ineligible registration.
async function submitReview(formData: FormData) {
  "use server";
  const reference = normaliseReference(String(formData.get("reference") ?? ""));
  if (!reference) notFound();

  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.reference, reference),
  });
  if (!registration || registration.status !== "confirmed") notFound();

  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, registration.eventId),
  });
  if (!event || !isEventOver(event)) notFound();

  // One review per registration — silently no-op if they already left one.
  const existing = await findReviewForRegistration(registration.id);
  if (existing) redirect(`/review/${reference}?submitted=1`);

  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`/review/${reference}?error=rating`);
  }
  const comment = String(formData.get("comment") ?? "").trim() || null;

  await db.insert(schema.reviews).values({
    orgId: registration.orgId,
    eventId: registration.eventId,
    registrationId: registration.id,
    rating,
    comment,
  });
  redirect(`/review/${reference}?submitted=1`);
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-2xl leading-none text-amber-400" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-zinc-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { reference: raw } = await params;
  const { submitted, error } = await searchParams;

  const reference = normaliseReference(raw);
  if (!reference) notFound();

  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.reference, reference),
  });
  if (!registration) notFound();
  // Only registrations that were confirmed (a genuine place at the event) can
  // be reviewed; cancelled/pending have nothing to rate.
  if (registration.status !== "confirmed") notFound();

  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, registration.eventId),
  });
  if (!event) notFound();

  const firstName = registration.contactName.split(" ")[0] || registration.contactName;
  const existing = await findReviewForRegistration(registration.id);

  // Reviews only open once the event is over.
  if (!isEventOver(event)) {
    return (
      <Shell>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Feedback</p>
        <h1 className="mt-1 text-xl font-bold">{event.title}</h1>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This event hasn&rsquo;t finished yet. We&rsquo;ll invite you to leave a review once it&rsquo;s over — thanks for
          registering, {firstName}.
        </p>
      </Shell>
    );
  }

  // Already reviewed, or just submitted — thank them and show their rating.
  if (existing || submitted) {
    return (
      <Shell>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Thank you</p>
        <h1 className="mt-1 text-xl font-bold">{event.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Thanks for your feedback, {firstName} — it goes straight to the event organiser.
        </p>
        {existing && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <Stars rating={existing.rating} />
            {existing.comment && (
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{existing.comment}</p>
            )}
          </div>
        )}
      </Shell>
    );
  }

  const input =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Your feedback</p>
      <h1 className="mt-1 text-xl font-bold">How was {event.title}?</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Thanks for coming, {firstName}. Your rating helps the organiser plan future events.
      </p>

      {error === "rating" && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Please pick a star rating from 1 to 5.
        </p>
      )}

      <form action={submitReview} className="mt-5 space-y-5">
        <input type="hidden" name="reference" value={reference} />
        <div>
          <label className="block text-sm font-medium text-zinc-700">Your rating</label>
          <div className="mt-2">
            <StarRating name="rating" />
          </div>
        </div>
        <label className="block text-sm font-medium text-zinc-700">
          Comments (optional)
          <textarea
            name="comment"
            rows={4}
            placeholder="What did you enjoy? What could be better?"
            className={input}
          />
        </label>
        <button className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
          Submit review
        </button>
      </form>
    </Shell>
  );
}
