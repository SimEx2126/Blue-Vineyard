import { createEvent } from "../../actions";
import { EventFields } from "../EventFields";
import { BannerField } from "@/components/BannerField";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-bold">New event</h1>
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {/* Details on the left, banner alongside on the right. */}
      <form action={createEvent} className="mt-6 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <EventFields />
          <button
            type="submit"
            className="mt-6 rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Create event
          </button>
        </div>
        <div className="mt-6 lg:mt-0">
          <BannerField name="heroImageUrl" />
        </div>
      </form>
    </div>
  );
}
