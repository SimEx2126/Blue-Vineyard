import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: slug } = await searchParams;
  const event = slug
    ? await db.query.events.findFirst({ where: eq(schema.events.slug, slug) })
    : null;

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-bold">Registration confirmed</h1>
        <p className="mt-2 text-zinc-600">
          {event
            ? `You're registered for ${event.title}.`
            : "Your registration has been received."}{" "}
          A confirmation email is on its way.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100"
        >
          Back to events
        </Link>
      </div>
    </div>
  );
}
