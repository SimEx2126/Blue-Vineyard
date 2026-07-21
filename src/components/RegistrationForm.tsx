"use client";

import { useMemo, useRef, useState } from "react";
import type { ChoiceOption, EventSectionDTO, SectionConfigMap } from "@/lib/sections";
import { formatCents } from "@/lib/pricing";

type TierVM = {
  id: number;
  label: string;
  amountCents: number;
  availableFrom: string | null;
  availableUntil: string | null;
  active: boolean;
};
type AddOnVM = { id: number; label: string; amountCents: number };

type Props = {
  eventId: number;
  sections: EventSectionDTO[];
  tiers: TierVM[];
  addOns: AddOnVM[];
  choiceCounts: Record<string, Record<string, number>>;
};

type Answers = Record<string, Record<string, unknown>>;

const inputCls =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const labelCls = "block text-sm font-medium text-zinc-700";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function RegistrationForm({ eventId, sections, tiers, addOns, choiceCounts }: Props) {
  const [answers, setAnswers] = useState<Answers>(() => {
    // Pre-populate defaults that the inputs display, so state matches the UI.
    const initial: Answers = {};
    for (const s of sections) {
      if (s.kind === "address") initial[String(s.id)] = { country: "Australia" };
    }
    return initial;
  });
  const [tierId, setTierId] = useState<number | null>(
    tiers.filter((t) => t.active).length === 1 ? tiers.find((t) => t.active)!.id : null
  );
  const [addOnIds, setAddOnIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (sectionId: number, field: string, value: unknown) =>
    setAnswers((prev) => ({
      ...prev,
      [String(sectionId)]: { ...prev[String(sectionId)], [field]: value },
    }));

  const get = (sectionId: number, field: string) =>
    answers[String(sectionId)]?.[field];

  const toggleInArray = (sectionId: number, field: string, value: string) => {
    const current = (get(sectionId, field) as string[] | undefined) ?? [];
    set(
      sectionId,
      field,
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  };

  const total = useMemo(() => {
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) return null;
    const subtotal =
      tier.amountCents +
      addOns.filter((a) => addOnIds.includes(a.id)).reduce((s, a) => s + a.amountCents, 0);
    return { subtotal, discount: 0, total: subtotal };
  }, [tiers, tierId, addOns, addOnIds]);

  // ---- Steps ----
  // Sections are grouped into a short wizard so the form isn't one long scroll.
  // Info blocks ride along with the section they introduce.
  const steps = useMemo(() => {
    const GROUPS: { title: string; kinds: string[] }[] = [
      { title: "Your details", kinds: ["personal", "address"] },
      { title: "Medical & emergency", kinds: ["medical", "emergency"] },
      { title: "Preferences", kinds: ["dietary", "choice", "media_consent", "custom_question"] },
      { title: "Agreement", kinds: ["consent"] },
    ];
    const buckets = GROUPS.map((g) => ({ title: g.title, sections: [] as EventSectionDTO[] }));
    let pendingInfo: EventSectionDTO[] = [];
    for (const s of sections) {
      if (s.kind === "text_block") {
        pendingInfo.push(s);
        continue;
      }
      const gi = GROUPS.findIndex((g) => g.kinds.includes(s.kind));
      const target = buckets[gi === -1 ? 0 : gi];
      target.sections.push(...pendingInfo, s);
      pendingInfo = [];
    }
    const result = buckets.filter((b) => b.sections.length > 0);
    if (pendingInfo.length && result.length) result[result.length - 1].sections.push(...pendingInfo);
    if (tiers.length > 0) result.push({ title: "Registration & payment", sections: [] });
    return result;
  }, [sections, tiers]);

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex >= steps.length - 1;
  const isPaymentStep = isLastStep && tiers.length > 0;
  const formRef = useRef<HTMLFormElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  // Let the browser's own validation gate each step.
  function validateStep() {
    const fields = stepRef.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea");
    for (const field of fields ?? []) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goNext() {
    if (!validateStep()) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    scrollToForm();
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
    scrollToForm();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Enter on an earlier step advances rather than submitting.
    if (!isLastStep) {
      goNext();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          answers,
          tierId,
          addOnIds,
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
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  }

  function renderSection(section: EventSectionDTO) {
    const id = section.id;
    switch (section.kind) {
      case "text_block": {
        const cfg = section.config as SectionConfigMap["text_block"];
        return (
          <div className="rounded-lg bg-zinc-100 p-4 text-sm text-zinc-700">
            {cfg.title && <h3 className="mb-1 font-semibold">{cfg.title}</h3>}
            <p className="whitespace-pre-line">{cfg.body}</p>
          </div>
        );
      }
      case "personal": {
        const cfg = section.config as SectionConfigMap["personal"];
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required>
              <input
                className={inputCls}
                required
                value={(get(id, "firstName") as string) ?? ""}
                onChange={(e) => set(id, "firstName", e.target.value)}
              />
            </Field>
            <Field label="Last name" required>
              <input
                className={inputCls}
                required
                value={(get(id, "lastName") as string) ?? ""}
                onChange={(e) => set(id, "lastName", e.target.value)}
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                className={inputCls}
                required
                value={(get(id, "email") as string) ?? ""}
                onChange={(e) => set(id, "email", e.target.value)}
              />
            </Field>
            <Field label="Phone / mobile" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "phone") as string) ?? ""}
                onChange={(e) => set(id, "phone", e.target.value)}
              />
            </Field>
            {cfg.church && (
              <div className="sm:col-span-2">
                <Field label="Name of the church you attend" required={section.required}>
                  <input
                    className={inputCls}
                    required={section.required}
                    value={(get(id, "church") as string) ?? ""}
                    onChange={(e) => set(id, "church", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        );
      }
      case "address":
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Street name and number" required={section.required}>
                <input
                  className={inputCls}
                  required={section.required}
                  value={(get(id, "street") as string) ?? ""}
                  onChange={(e) => set(id, "street", e.target.value)}
                />
              </Field>
            </div>
            <Field label="City / suburb" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "city") as string) ?? ""}
                onChange={(e) => set(id, "city", e.target.value)}
              />
            </Field>
            <Field label="State" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "state") as string) ?? ""}
                onChange={(e) => set(id, "state", e.target.value)}
              />
            </Field>
            <Field label="Postcode" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "postcode") as string) ?? ""}
                onChange={(e) => set(id, "postcode", e.target.value)}
              />
            </Field>
            <Field label="Country" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "country") as string) ?? "Australia"}
                onChange={(e) => set(id, "country", e.target.value)}
              />
            </Field>
          </div>
        );
      case "medical": {
        const cfg = section.config as SectionConfigMap["medical"];
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Family doctor" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "doctorName") as string) ?? ""}
                onChange={(e) => set(id, "doctorName", e.target.value)}
              />
            </Field>
            <Field label="Doctor's phone number" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "doctorPhone") as string) ?? ""}
                onChange={(e) => set(id, "doctorPhone", e.target.value)}
              />
            </Field>
            {cfg.medicare && (
              <Field label="Medicare number" required={section.required}>
                <input
                  className={inputCls}
                  required={section.required}
                  value={(get(id, "medicare") as string) ?? ""}
                  onChange={(e) => set(id, "medicare", e.target.value)}
                />
              </Field>
            )}
          </div>
        );
      }
      case "emergency":
        return (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Contact name" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "name") as string) ?? ""}
                onChange={(e) => set(id, "name", e.target.value)}
              />
            </Field>
            <Field label="Relationship" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "relationship") as string) ?? ""}
                onChange={(e) => set(id, "relationship", e.target.value)}
              />
            </Field>
            <Field label="Mobile" required={section.required}>
              <input
                className={inputCls}
                required={section.required}
                value={(get(id, "mobile") as string) ?? ""}
                onChange={(e) => set(id, "mobile", e.target.value)}
              />
            </Field>
          </div>
        );
      case "consent": {
        const cfg = section.config as SectionConfigMap["consent"];
        return (
          <div>
            <p className="whitespace-pre-line rounded-lg bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-600">
              {cfg.body}
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                required={section.required}
                className="mt-0.5"
                checked={Boolean(get(id, "agreed"))}
                onChange={(e) => set(id, "agreed", e.target.checked)}
              />
              <span>
                I have read and agree to the above
                {section.required && <span className="text-red-600"> *</span>}
              </span>
            </label>
          </div>
        );
      }
      case "dietary": {
        const cfg = section.config as SectionConfigMap["dietary"];
        const selected = ((get(id, "selected") as string[]) ?? []);
        return (
          <div>
            <div className="space-y-2">
              {cfg.options.map((opt) => (
                <label key={opt} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.includes(opt)}
                    onChange={() => toggleInArray(id, "selected", opt)}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            {cfg.detailsPrompt && (
              <Field label={cfg.detailsPrompt}>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={(get(id, "details") as string) ?? ""}
                  onChange={(e) => set(id, "details", e.target.value)}
                />
              </Field>
            )}
          </div>
        );
      }
      case "choice": {
        const cfg = section.config as SectionConfigMap["choice"];
        const counts = choiceCounts[String(id)] ?? {};
        const isFull = (o: ChoiceOption) =>
          o.capacity != null && (counts[o.id] ?? 0) >= o.capacity;
        if (cfg.multiple) {
          const selected = ((get(id, "selected") as string[]) ?? []);
          return (
            <div className="space-y-2">
              {cfg.options.map((o) => (
                <label key={o.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={isFull(o) && !selected.includes(o.id)}
                    checked={selected.includes(o.id)}
                    onChange={() => toggleInArray(id, "selected", o.id)}
                  />
                  <span className={isFull(o) ? "text-zinc-400 line-through" : ""}>
                    {o.label}
                    {isFull(o) && " (full)"}
                  </span>
                </label>
              ))}
            </div>
          );
        }
        return (
          <div className="space-y-2">
            {cfg.options.map((o) => (
              <label key={o.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={`choice-${id}`}
                  className="mt-0.5"
                  required={section.required}
                  disabled={isFull(o)}
                  checked={get(id, "selected") === o.id}
                  onChange={() => set(id, "selected", o.id)}
                />
                <span className={isFull(o) ? "text-zinc-400 line-through" : ""}>
                  {o.label}
                  {isFull(o) && " (full)"}
                </span>
              </label>
            ))}
          </div>
        );
      }
      case "media_consent": {
        const cfg = section.config as SectionConfigMap["media_consent"];
        const selected = ((get(id, "selected") as string[]) ?? []);
        return (
          <div className="space-y-2">
            {cfg.options.map((opt) => (
              <label key={opt} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.includes(opt)}
                  onChange={() => toggleInArray(id, "selected", opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );
      }
      case "custom_question": {
        const cfg = section.config as SectionConfigMap["custom_question"];
        if (cfg.type === "checkbox") {
          return (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                required={section.required}
                className="mt-0.5"
                checked={Boolean(get(id, "value"))}
                onChange={(e) => set(id, "value", e.target.checked)}
              />
              <span>
                {cfg.label}
                {section.required && <span className="text-red-600"> *</span>}
              </span>
            </label>
          );
        }
        if (cfg.type === "select") {
          return (
            <Field label={cfg.label} required={section.required}>
              <select
                className={inputCls}
                required={section.required}
                value={(get(id, "value") as string) ?? ""}
                onChange={(e) => set(id, "value", e.target.value)}
              >
                <option value="">Please select…</option>
                {(cfg.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          );
        }
        if (cfg.type === "textarea") {
          return (
            <Field label={cfg.label} required={section.required}>
              <textarea
                className={inputCls}
                rows={3}
                required={section.required}
                placeholder={cfg.placeholder}
                value={(get(id, "value") as string) ?? ""}
                onChange={(e) => set(id, "value", e.target.value)}
              />
            </Field>
          );
        }
        return (
          <Field label={cfg.label} required={section.required}>
            <input
              className={inputCls}
              required={section.required}
              placeholder={cfg.placeholder}
              value={(get(id, "value") as string) ?? ""}
              onChange={(e) => set(id, "value", e.target.value)}
            />
          </Field>
        );
      }
    }
  }

  const sectionTitle = (s: EventSectionDTO): string | null => {
    switch (s.kind) {
      case "personal":
        return "Personal details";
      case "address":
        return "Address";
      case "medical":
        return "Medical details";
      case "emergency":
        return "Emergency contact";
      case "consent":
        return (s.config as SectionConfigMap["consent"]).title ?? "Consent";
      case "dietary":
        return "Dietary requirements";
      case "choice":
        return (s.config as SectionConfigMap["choice"]).label;
      case "media_consent":
        return "Consent for media";
      default:
        return null;
    }
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-6 scroll-mt-6">
      {steps.length > 1 && (
        <div className="mb-6">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-zinc-900">{currentStep.title}</h3>
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Step {stepIndex + 1} of {steps.length}
            </span>
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={`h-1 flex-1 rounded-full ${
                  i <= stepIndex ? "bg-teal-700" : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={stepRef} className="space-y-8">
        {currentStep.sections.map((s) => (
          <section key={s.id}>
            {sectionTitle(s) && (
              <h4 className="mb-3 text-sm font-semibold text-zinc-900">{sectionTitle(s)}</h4>
            )}
            {renderSection(s)}
          </section>
        ))}

      {isPaymentStep && (
        <section>
          <h3 className="mb-3 text-base font-semibold text-zinc-900">Registration options</h3>
          <div className="space-y-2">
            {tiers.map((t) => (
              <label key={t.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="tier"
                  className="mt-0.5"
                  required
                  disabled={!t.active}
                  checked={tierId === t.id}
                  onChange={() => setTierId(t.id)}
                />
                <span className={t.active ? "" : "text-zinc-400"}>
                  {t.label} — {formatCents(t.amountCents)}
                  {!t.active &&
                    (t.availableFrom && new Date(t.availableFrom) > new Date()
                      ? ` (available from ${new Date(t.availableFrom).toLocaleDateString("en-AU")})`
                      : " (no longer available)")}
                </span>
              </label>
            ))}
          </div>
          {addOns.length > 0 && (
            <div className="mt-4 space-y-2">
              {addOns.map((a) => (
                <label key={a.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={addOnIds.includes(a.id)}
                    onChange={() =>
                      setAddOnIds((prev) =>
                        prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                      )
                    }
                  />
                  <span>
                    {a.label} — {formatCents(a.amountCents)}
                  </span>
                </label>
              ))}
            </div>
          )}

          {total && (
            <div className="mt-5 max-w-sm rounded-lg border border-zinc-200 bg-white p-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCents(total.subtotal)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 font-semibold">
                <span>Total</span>
                <span>{formatCents(total.total)}</span>
              </div>
            </div>
          )}
        </section>
      )}

      {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3 border-t border-zinc-200 pt-6">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-zinc-300 px-5 py-3 text-sm font-medium hover:bg-zinc-100"
          >
            Back
          </button>
        )}
        {isLastStep ? (
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : tiers.length > 0 ? "Continue to payment" : "Submit registration"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
          >
            Next
          </button>
        )}
      </div>
    </form>
  );
}
