import type { schema } from "@/db";

type EventRow = typeof schema.events.$inferSelect;

const input =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const label = "block text-sm font-medium text-zinc-700";

function dtLocal(d: Date | null | undefined) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventFields({ event }: { event?: EventRow }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={label}>
        Title
        <input name="title" required defaultValue={event?.title} className={input} />
      </label>
      <label className={label}>
        Slug (URL)
        <input name="slug" required defaultValue={event?.slug} className={input} placeholder="2026-womens-retreat" />
      </label>
      <label className={label}>
        Category
        <input name="category" defaultValue={event?.category ?? ""} className={input} placeholder="Womens Ministries" />
      </label>
      <label className={label}>
        Location
        <input name="location" defaultValue={event?.location ?? ""} className={input} />
      </label>
      <div className="sm:col-span-2">
        <label className={label}>
          Description
          <textarea name="description" rows={5} defaultValue={event?.description ?? ""} className={input} />
        </label>
      </div>
      <label className={label}>
        Event starts
        <input type="datetime-local" name="startsAt" defaultValue={dtLocal(event?.startsAt)} className={input} />
      </label>
      <label className={label}>
        Event ends
        <input type="datetime-local" name="endsAt" defaultValue={dtLocal(event?.endsAt)} className={input} />
      </label>
      <label className={label}>
        Registrations open
        <input type="datetime-local" name="opensAt" defaultValue={dtLocal(event?.opensAt)} className={input} />
      </label>
      <label className={label}>
        Registrations close
        <input type="datetime-local" name="closesAt" defaultValue={dtLocal(event?.closesAt)} className={input} />
      </label>
      <label className={label}>
        Capacity (blank = unlimited)
        <input type="number" name="capacity" min={1} defaultValue={event?.capacity ?? ""} className={input} />
      </label>
      <label className={label}>
        Status
        <select name="status" defaultValue={event?.status ?? "draft"} className={input}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <div className="sm:col-span-2">
        <label className={label}>
          Message shown when full
          <input name="fullMessage" defaultValue={event?.fullMessage ?? ""} className={input} />
        </label>
      </div>
    </div>
  );
}
