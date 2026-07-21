import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatCents } from "@/lib/pricing";
import { normaliseReference } from "@/lib/reference";
import { extensionForType, isStorageConfigured, putMedia } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Pricing = {
  tier: { label: string; amountCents: number } | null;
  addOns: { label: string; amountCents: number }[];
  coupon: { code: string; discountCents: number } | null;
  totalCents: number;
};

const MAX_BYTES = 5 * 1024 * 1024;

async function submitProof(formData: FormData) {
  "use server";
  const reference = normaliseReference(String(formData.get("reference") ?? ""));
  if (!reference) notFound();

  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.reference, reference),
  });
  if (!registration || registration.status !== "pending") notFound();

  const proofReference = String(formData.get("proofReference") ?? "").trim() || null;
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  const err = (code: string) => redirect(`/pay/${reference}?error=${code}`);

  if (!hasFile && !proofReference) err("empty");

  let proofKey = registration.proofKey;
  if (hasFile) {
    if (!extensionForType(file.type)) err("type");
    if (file.size > MAX_BYTES) err("size");
    if (!isStorageConfigured()) err("storage");
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      proofKey = await putMedia(buffer, file.type, "proofs");
    } catch {
      err("upload");
    }
  }

  await db
    .update(schema.registrations)
    .set({ proofKey, proofReference, proofSubmittedAt: new Date() })
    .where(eq(schema.registrations.id, registration.id));

  redirect(`/pay/${reference}?submitted=1`);
}

const ERRORS: Record<string, string> = {
  empty: "Please attach a screenshot or enter your payment reference.",
  type: "Please upload a PNG, JPG, WebP or GIF image.",
  size: "Images must be under 5 MB.",
  storage: "File uploads aren't available right now — please enter your reference number instead.",
  upload: "Upload failed — please try again.",
};

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { reference: raw } = await params;
  const { submitted, error } = await searchParams;

  // Keyed on the random reference, not a sequential id, so /pay can't be walked.
  const reference = normaliseReference(raw);
  if (!reference) notFound();

  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.reference, reference),
  });
  if (!registration) notFound();

  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, registration.eventId),
  });
  if (registration.status === "confirmed") {
    redirect(`/register/confirmed?ref=${registration.reference}`);
  }
  if (registration.status === "cancelled") notFound();

  const pricing = registration.pricing as Pricing;
  const alreadySubmitted = !!registration.proofSubmittedAt;
  const input =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Registration received
        </p>
        <h1 className="mt-1 text-xl font-bold">{event?.title ?? "Your registration"}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your place is held for {registration.contactName}. It&apos;s confirmed once payment is
          received.
        </p>

        <dl className="mt-5 space-y-2 text-sm">
          {pricing.tier && (
            <div className="flex justify-between">
              <dt>{pricing.tier.label}</dt>
              <dd>{formatCents(pricing.tier.amountCents)}</dd>
            </div>
          )}
          {pricing.addOns?.map((a) => (
            <div key={a.label} className="flex justify-between">
              <dt>{a.label}</dt>
              <dd>{formatCents(a.amountCents)}</dd>
            </div>
          ))}
          {pricing.coupon && (
            <div className="flex justify-between text-teal-700">
              <dt>Coupon {pricing.coupon.code}</dt>
              <dd>−{formatCents(pricing.coupon.discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
            <dt>Amount due</dt>
            <dd>{formatCents(registration.amountCents)}</dd>
          </div>
          {registration.reference && (
            <div className="flex justify-between pt-1">
              <dt className="text-zinc-500">Your reference</dt>
              <dd className="font-mono font-semibold">{registration.reference}</dd>
            </div>
          )}
        </dl>

        {event?.paymentInstructions?.trim() ? (
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              How to pay
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">
              {event.paymentInstructions}
            </p>
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Payment details will be sent to you by the event organiser.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Upload proof of payment</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Once you&apos;ve paid, attach a screenshot and/or enter your payment reference. You can
          also come back to this page later using the link in your email.
        </p>

        {submitted && (
          <p className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
            Thanks — we&apos;ve received your proof and will confirm your place once the payment is
            checked.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {ERRORS[error] ?? "Something went wrong."}
          </p>
        )}
        {alreadySubmitted && !submitted && (
          <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            You&apos;ve already submitted proof
            {registration.proofReference ? ` (ref ${registration.proofReference})` : ""}. You can
            replace it below if needed.
          </p>
        )}

        <form action={submitProof} className="mt-4 space-y-4">
          <input type="hidden" name="reference" value={reference} />
          <label className="block text-sm font-medium text-zinc-700">
            Payment reference or note
            <input
              name="proofReference"
              defaultValue={registration.proofReference ?? ""}
              placeholder="e.g. your bank transfer receipt number"
              className={input}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Screenshot (optional)
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-zinc-100"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Submit proof
          </button>
        </form>
      </div>
    </div>
  );
}
