"use client";

import { useState } from "react";
import type { schema } from "@/db";

type EventRow = typeof schema.events.$inferSelect;

const input =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const label = "block text-sm font-medium text-zinc-700";

// Pre-filled on a new event so the field is never blank; the organiser can edit
// or clear it. Mirrors the runtime fallback used when no message is saved.
const DEFAULT_FULL_MESSAGE = "Registrations for this event are now full.";

// Date only (no time) for the date-typed fields.
function dLocal(d: Date | null | undefined) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EventFields({ event }: { event?: EventRow }) {
  // Registrations close follows the event end date: setting the end date fills
  // in the close date, until the organiser sets close to something of their
  // own. On an existing event with a saved close date, that saved value wins.
  const [endsAt, setEndsAt] = useState(dLocal(event?.endsAt));
  const [closesAt, setClosesAt] = useState(
    event?.closesAt ? dLocal(event.closesAt) : dLocal(event?.endsAt)
  );
  const [closeTouched, setCloseTouched] = useState(Boolean(event?.closesAt));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* The title is the one field every event needs, so it gets the full
          width and a larger face than the rest of the form. */}
      <label className={label + " sm:col-span-2"}>
        Title
        <input
          name="title"
          required
          defaultValue={event?.title}
          placeholder="Name of the event"
          className="mt-1 w-full rounded-lg border-2 border-teal-600/40 bg-white px-4 py-3 text-lg font-semibold shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        />
      </label>
      {/* The slug is the event's public web address. On creation it is derived
          from the title automatically, so the field appears only when editing
          an existing event — where changing it is a deliberate act. */}
      {event && (
        <label className={label + " sm:col-span-2"}>
          Slug (URL)
          <input
            name="slug"
            required
            defaultValue={event.slug}
            className={input}
            placeholder="2026-womens-retreat"
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            The public web address (/e/…). Changing it updates the shared link and QR code.
          </span>
        </label>
      )}
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
        <input type="date" name="startsAt" defaultValue={dLocal(event?.startsAt)} className={input} />
      </label>
      <label className={label}>
        Event ends
        <input
          type="date"
          name="endsAt"
          value={endsAt}
          onChange={(e) => {
            setEndsAt(e.target.value);
            // Mirror the end date into the close date until it is set explicitly.
            if (!closeTouched) setClosesAt(e.target.value);
          }}
          className={input}
        />
      </label>
      <label className={label}>
        Registrations open
        {/* Defaults to today on a new event; the client's date is intentional,
            so hydration is allowed to differ from the server render. */}
        <input
          type="date"
          name="opensAt"
          defaultValue={event?.opensAt ? dLocal(event.opensAt) : dLocal(new Date())}
          suppressHydrationWarning
          className={input}
        />
      </label>
      <label className={label}>
        Registrations close
        <input
          type="date"
          name="closesAt"
          value={closesAt}
          onChange={(e) => {
            setClosesAt(e.target.value);
            setCloseTouched(true);
          }}
          className={input}
        />
      </label>
      <label className={label}>
        Attendees (blank = unlimited)
        <input type="number" name="capacity" min={1} defaultValue={event?.capacity ?? ""} className={input} />
      </label>
      {/* New events publish immediately; the status control only appears when
          editing, for archiving or taking an event offline. */}
      {event && (
        <label className={label}>
          Status
          <select name="status" defaultValue={event.status} className={input}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      )}
      <div className="flex items-center sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            name="requiresPayment"
            defaultChecked={event?.requiresPayment ?? false}
          />
          Registration requires payment
        </label>
        <span className="ml-3 text-xs text-zinc-500">
          When on, you set the price options below and registrants are asked to pay. When off, the
          event is free.
        </span>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>
          Message shown when full
          <input
            name="fullMessage"
            defaultValue={event?.fullMessage ?? DEFAULT_FULL_MESSAGE}
            className={input}
          />
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>
          Payment instructions
          <textarea
            name="paymentInstructions"
            rows={4}
            defaultValue={event?.paymentInstructions ?? ""}
            className={input}
            placeholder={
              "How registrants pay you (payment happens outside the app). e.g.\n" +
              "Bank transfer to BSB 000-000, Acc 12345678, ref your surname."
            }
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            Shown to registrants after they register. They pay outside the app and upload proof.
          </span>
        </label>
      </div>
    </div>
  );
}
