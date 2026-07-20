import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatCents } from "@/lib/pricing";
import { PayButton } from "./PayButton";

export const dynamic = "force-dynamic";

type Pricing = {
  tier: { label: string; amountCents: number } | null;
  addOns: { label: string; amountCents: number }[];
  coupon: { code: string; discountCents: number } | null;
  totalCents: number;
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;
  const id = Number(registrationId);
  if (!Number.isInteger(id)) notFound();

  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, id),
  });
  if (!registration) notFound();

  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, registration.eventId),
  });
  if (registration.status === "confirmed") {
    redirect(`/register/confirmed${event ? `?event=${event.slug}` : ""}`);
  }
  if (registration.status === "cancelled") notFound();

  const pricing = registration.pricing as Pricing;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Development checkout — this simulates the card payment step.
        </div>
        <h1 className="text-xl font-semibold">Payment</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {event?.title} — {registration.contactName}
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
            <dt>Total</dt>
            <dd>{formatCents(registration.amountCents)}</dd>
          </div>
        </dl>

        <PayButton registrationId={registration.id} amountLabel={formatCents(registration.amountCents)} />
      </div>
    </div>
  );
}
