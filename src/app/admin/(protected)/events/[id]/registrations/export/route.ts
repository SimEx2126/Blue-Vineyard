import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { SECTION_LABELS, type SectionConfigMap, type SectionKind } from "@/lib/sections";

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
  await requireAdmin();
  const { id } = await ctx.params;
  const eventId = Number(id);

  const event = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
  if (!event) return new Response("Not found", { status: 404 });

  const [sections, registrations] = await Promise.all([
    db.query.eventSections.findMany({
      where: eq(schema.eventSections.eventId, eventId),
      orderBy: (s, { asc }) => [asc(s.position), asc(s.id)],
    }),
    db.query.registrations.findMany({
      where: eq(schema.registrations.eventId, eventId),
      orderBy: (r, { asc }) => [asc(r.createdAt)],
    }),
  ]);
  const dataSections = sections.filter((s) => s.kind !== "text_block");

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

  const sectionHeader = (s: (typeof sections)[number]) =>
    s.kind === "custom_question"
      ? (s.config as SectionConfigMap["custom_question"]).label
      : SECTION_LABELS[s.kind as SectionKind] ?? s.kind;

  const header = [
    "ID",
    "Submitted",
    "Status",
    "Name",
    "Email",
    "Option",
    "Add-ons",
    "Coupon",
    "Total",
    "Payment",
    ...dataSections.map(sectionHeader),
  ];

  const rows = registrations.map((r) => {
    const answers = r.answers as Record<string, Record<string, unknown>>;
    const pricing = r.pricing as {
      tier: { label: string } | null;
      addOns: { label: string }[];
      coupon: { code: string } | null;
    };
    const sectionCells = dataSections.map((s) => {
      const a = answers[String(s.id)];
      if (!a) return "";
      if (s.kind === "choice") {
        const cfg = s.config as SectionConfigMap["choice"];
        const sel = a.selected;
        const toLabel = (v: unknown) => cfg.options.find((o) => o.id === v)?.label ?? String(v);
        return csvCell(Array.isArray(sel) ? sel.map(toLabel) : toLabel(sel));
      }
      const parts = Object.entries(a)
        .filter(([, v]) => v !== "" && v != null)
        .map(([k, v]) =>
          typeof v === "boolean" ? (v ? k : `not ${k}`) : Array.isArray(v) ? v.join("; ") : `${k}: ${v}`
        );
      return csvCell(parts.join(" | "));
    });
    return [
      r.id,
      r.createdAt.toISOString(),
      r.status,
      csvCell(r.contactName),
      csvCell(r.contactEmail),
      csvCell(pricing.tier?.label),
      csvCell(pricing.addOns?.map((a) => a.label)),
      csvCell(pricing.coupon?.code),
      (r.amountCents / 100).toFixed(2),
      paymentByReg.get(r.id) ?? (r.amountCents === 0 ? "free" : ""),
      ...sectionCells,
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
