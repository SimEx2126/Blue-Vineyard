import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { formatCents } from "@/lib/pricing";
import { eventListWhere, isViewer, requireUser } from "@/lib/access";
import { refundPayment } from "../actions";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await requireUser();
  // Viewers watch submissions, not the payment ledger.
  if (isViewer(user)) notFound();

  // The ledger is joined through to the event so the same organization-and-role
  // scoping used for the events list applies here; it exposes registrant names
  // alongside amounts, so it must never cross the tenant boundary.
  const rows = await db
    .select({
      payment: schema.payments,
      registration: schema.registrations,
      event: schema.events,
    })
    .from(schema.payments)
    .innerJoin(
      schema.registrations,
      eq(schema.payments.registrationId, schema.registrations.id)
    )
    .innerJoin(schema.events, eq(schema.registrations.eventId, schema.events.id))
    .where(eventListWhere(user))
    .orderBy(desc(schema.payments.createdAt))
    .limit(200);

  return (
    <div>
      <h1 className="text-2xl font-bold">Payments</h1>
      <p className="mt-1 text-sm text-zinc-500">All charges and refunds, newest first.</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        {/* min-width keeps the columns legible; the wrapper scrolls on phones. */}
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(({ payment, registration, event }) => (
              <tr key={payment.id}>
                <td className="px-4 py-3 text-zinc-400">{payment.id}</td>
                <td className="px-4 py-3">{event.title}</td>
                <td className="px-4 py-3 capitalize">{payment.kind}</td>
                <td className="px-4 py-3">{registration.contactName}</td>
                <td
                  className={`px-4 py-3 text-right ${payment.amountCents < 0 ? "text-red-600" : ""}`}
                >
                  {payment.amountCents < 0 ? "−" : ""}
                  {formatCents(Math.abs(payment.amountCents))}
                </td>
                <td className="px-4 py-3 capitalize text-zinc-500">{payment.gateway}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      payment.status === "paid"
                        ? "bg-teal-100 text-teal-800"
                        : payment.status === "refunded"
                          ? "bg-amber-100 text-amber-800"
                          : payment.status === "pending"
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-red-100 text-red-700"
                    }`}
                  >
                    {payment.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {payment.createdAt.toLocaleString("en-AU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  {payment.kind === "charge" && payment.status === "paid" && (
                    <form action={refundPayment.bind(null, payment.id)}>
                      <button className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                        Refund
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
