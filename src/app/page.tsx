import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start) return null;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  if (!end || fmt(end) === fmt(start)) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const events = await db.query.events.findMany({
    where: category
      ? and(eq(schema.events.status, "published"), eq(schema.events.category, category))
      : eq(schema.events.status, "published"),
    orderBy: (e, { asc }) => [asc(e.startsAt)],
  });

  const allCategories = Array.from(
    new Set(
      (
        await db.query.events.findMany({
          where: eq(schema.events.status, "published"),
          columns: { category: true },
        })
      )
        .map((e) => e.category)
        .filter((c): c is string => !!c)
    )
  ).sort();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Current events</h1>
      <p className="mt-1 text-zinc-500">Register for upcoming conference events.</p>

      {allCategories.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/"
            className={`rounded-full border px-3 py-1 text-sm ${
              !category
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-500"
            }`}
          >
            All
          </Link>
          {allCategories.map((c) => (
            <Link
              key={c}
              href={`/?category=${encodeURIComponent(c)}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                category === c
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-zinc-300 text-zinc-600 hover:border-zinc-500"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/e/${event.slug}`}
            className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
          >
            {event.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.heroImageUrl} alt="" className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 w-full items-end bg-gradient-to-br from-teal-700 to-teal-900 p-4">
                <span className="text-lg font-semibold text-white/90">{event.title}</span>
              </div>
            )}
            <div className="p-4">
              {event.category && (
                <div className="text-xs font-medium uppercase tracking-wide text-teal-700">
                  {event.category}
                </div>
              )}
              <h2 className="mt-1 font-semibold group-hover:underline">{event.title}</h2>
              <div className="mt-1 text-sm text-zinc-500">
                {formatDateRange(event.startsAt, event.endsAt)}
                {event.location ? ` · ${event.location}` : ""}
              </div>
            </div>
          </Link>
        ))}
        {events.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
            No events in this category right now.
          </p>
        )}
      </div>
    </div>
  );
}
