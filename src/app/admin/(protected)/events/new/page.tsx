import { notFound } from "next/navigation";
import { createEvent } from "../../actions";
import { EventFields } from "../EventFields";
import { BannerField } from "@/components/BannerField";
import { canManageEvents, requireUser } from "@/lib/access";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; kind?: string }>;
}) {
  // Viewers are read-only — no create form.
  const user = await requireUser();
  if (!canManageEvents(user)) notFound();
  const { error, kind } = await searchParams;
  // A "form" is a light event — same page, with the event-only fields hidden.
  const isForm = kind === "form";
  return (
    <div>
      <h1 className="text-2xl font-bold">{isForm ? "New form" : "New event"}</h1>
      {isForm && (
        <p className="mt-1 text-sm text-zinc-500">
          A standalone registration form with its own link and QR code — no event details needed.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {/* Details on the left, banner alongside on the right. */}
      <form action={createEvent} className="mt-6 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          {isForm && <input type="hidden" name="kind" value="form" />}
          <EventFields kind={isForm ? "form" : "event"} />
          <button
            type="submit"
            className="mt-6 rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {isForm ? "Create form" : "Create event"}
          </button>
        </div>
        <div className="mt-6 lg:mt-0">
          <BannerField name="heroImageUrl" />
        </div>
      </form>
    </div>
  );
}
