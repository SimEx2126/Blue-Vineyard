import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertCanViewEvent } from "@/lib/access";
import { getReviewSummary } from "@/lib/review";

export const dynamic = "force-dynamic";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-lg leading-none text-amber-400" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-zinc-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default async function EventReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  const { event } = await assertCanViewEvent(eventId);

  const summary = await getReviewSummary(eventId);
  const reviews = await db.query.reviews.findMany({
    where: eq(schema.reviews.eventId, eventId),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  // Names come from the linked registrations.
  const regIds = reviews.map((r) => r.registrationId);
  const regs = regIds.length
    ? await db.query.registrations.findMany({
        where: inArray(schema.registrations.id, regIds),
        columns: { id: true, contactName: true },
      })
    : [];
  const nameByReg = new Map(regs.map((r) => [r.id, r.contactName]));

  // Star distribution, 5 → 1.
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/events/${eventId}/registrations`}
        className="text-sm text-teal-700 hover:underline"
      >
        ← All registrations
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Reviews — {event.title}</h1>

      {summary.count === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          No reviews yet. Once the event is over, use “Send review invites” on the registrations page
          to ask participants for feedback.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-8 rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-zinc-900">{summary.average?.toFixed(1)}</div>
              <div className="mt-1 text-amber-400">
                <Stars rating={Math.round(summary.average ?? 0)} />
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {summary.count} {summary.count === 1 ? "review" : "reviews"}
              </div>
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1">
              {dist.map(({ star, count }) => {
                const pct = summary.count ? Math.round((count / summary.count) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="w-3 text-right">{star}</span>
                    <span className="text-amber-400">★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-6 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900">
                    {nameByReg.get(r.registrationId) ?? "Participant"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {r.createdAt.toLocaleDateString("en-AU")}
                  </span>
                </div>
                <div className="mt-1">
                  <Stars rating={r.rating} />
                </div>
                {r.comment && (
                  <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
