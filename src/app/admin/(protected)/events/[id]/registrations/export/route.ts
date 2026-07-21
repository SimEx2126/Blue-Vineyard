import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertCanViewEvent } from "@/lib/access";

function csvCell(value: unknown): string {
  if (value == null || value === "") return "";
  let s: string;
  if (Array.isArray(value)) s = value.join("; ");
  else if (typeof value === "boolean") s = value ? "Yes" : "No";
  else s = String(value);
  if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);

  // Route handlers do not run the (protected) layout, so this check is the
  // only thing standing in front of the registrant CSV.
  const { event } = await assertCanViewEvent(eventId);

  const registrations = await db.query.registrations.findMany({
    where: eq(schema.registrations.eventId, eventId),
    orderBy: (r, { asc }) => [asc(r.createdAt)],
  });

  const paymentRows = registrations.length
    ? await db.query.payments.findMany({
        where: inArray(
          schema.payments.registrationId,
          registrations.map((r) => r.id)
        ),
      })
    : [];
  const paymentByReg = new Map<number, string>();
  for (const p of paymentRows) {
    if (p.kind === "charge") paymentByReg.set(p.registrationId, p.status);
  }

  const header = [
    "ID",
    "Ticket no.",
    "Submitted",
    "Status",
    "Full name",
    "Email",
    "Gender",
    "Age",
    "Address",
    "Parent phone",
    "Parent consent",
    "Media consent",
    "Option",
    "Total",
    "Payment",
  ];

  const rows = registrations.map((r) => {
    const pricing = r.pricing as {
      tier: { label: string } | null;
    };
    return [
      r.id,
      csvCell(r.reference),
      r.createdAt.toISOString(),
      r.status,
      csvCell(r.contactName),
      csvCell(r.contactEmail),
      csvCell(r.gender),
      csvCell(r.age),
      csvCell(r.address),
      csvCell(r.parentPhone),
      csvCell(r.parentConsent),
      csvCell(r.mediaConsent),
      csvCell(pricing.tier?.label),
      (r.amountCents / 100).toFixed(2),
      paymentByReg.get(r.id) ?? (r.amountCents === 0 ? "free" : ""),
    ].join(",");
  });

  const csv = [header.map(csvCell).join(","), ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-registrations.csv"`,
    },
  });
}
