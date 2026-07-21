"use client";

import { useState } from "react";
import { formatCents } from "@/lib/pricing";

type TierVM = {
  id: number;
  label: string;
  amountCents: number;
};

type Props = {
  eventId: number;
  // Empty for free events — the price picker only shows when there is
  // something to pay.
  tiers: TierVM[];
};

const inputCls =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const labelCls = "block text-sm font-medium text-zinc-700";

/**
 * The one registration form, same for every event: full name, email, gender,
 * age, address, media consent, and parent/guardian phone + consent (which
 * doubles as the emergency contact).
 */
export function RegistrationForm({ eventId, tiers }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [address, setAddress] = useState("");
  const [mediaConsent, setMediaConsent] = useState(false);
  const [parentPhone, setParentPhone] = useState("");
  const [parentConsent, setParentConsent] = useState(false);
  const [tierId, setTierId] = useState<number | null>(
    tiers.length === 1 ? tiers[0].id : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = tiers.find((t) => t.id === tierId)?.amountCents ?? null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          tierId,
          fullName,
          email,
          gender,
          age: Number(age),
          address,
          mediaConsent,
          parentPhone,
          parentConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please check your details and try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Full name
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Gender
          <select
            required
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>
              Select…
            </option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className={labelCls}>
          Age
          <input
            type="number"
            min={1}
            max={120}
            required
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls + " sm:col-span-2"}>
          Address
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls}
            placeholder="Street, suburb, state and postcode"
          />
        </label>
        <label className={labelCls + " sm:col-span-2"}>
          Parent/guardian phone number
          <input
            type="tel"
            required
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            className={inputCls}
            placeholder="e.g. 0400 000 000"
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            This number is also used as your emergency contact.
          </span>
        </label>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={parentConsent}
            onChange={(e) => setParentConsent(e.target.checked)}
          />
          <span>I have my parent&rsquo;s/guardian&rsquo;s consent to attend this event.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={mediaConsent}
            onChange={(e) => setMediaConsent(e.target.checked)}
          />
          <span>
            I give consent for photos and videos taken at the event to be used by the organizers.
          </span>
        </label>
      </div>

      {tiers.length > 0 && (
        <div>
          <h3 className="mb-2 text-base font-semibold text-zinc-900">Registration options</h3>
          <div className="space-y-2">
            {tiers.map((t) => (
              <label key={t.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="tier"
                  className="mt-0.5"
                  required
                  checked={tierId === t.id}
                  onChange={() => setTierId(t.id)}
                />
                <span>
                  {t.label} — {formatCents(t.amountCents)}
                </span>
              </label>
            ))}
          </div>
          {total != null && (
            <div className="mt-4 max-w-sm rounded-lg border border-zinc-200 bg-white p-4 text-sm">
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCents(total)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Register"}
      </button>
    </form>
  );
}
