import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { buildAnswersSchema, extractContact, type SectionConfigMap } from "@/lib/sections";
import { computeTotal, tierIsActive } from "@/lib/pricing";
import {
  choiceOptionCounts,
  findValidCoupon,
  getOpenState,
  toSectionDTOs,
  validateAddOnIds,
} from "@/lib/registration";
import { getGateway } from "@/lib/payments";
import { confirmRegistration } from "@/lib/confirm";

const bodySchema = z.object({
  eventId: z.number().int(),
  answers: z.record(z.string(), z.unknown()),
  tierId: z.number().int().nullable(),
  addOnIds: z.array(z.number().int()).default([]),
  couponCode: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const event = await db.query.events.findFirst({
    where: and(eq(schema.events.id, body.eventId), eq(schema.events.status, "published")),
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  // Scheduling + capacity are enforced server-side, not just hidden in the UI.
  const openState = await getOpenState(event);
  if (!openState.open) {
    return NextResponse.json({ error: openState.message }, { status: 409 });
  }

  const sections = toSectionDTOs(
    await db.query.eventSections.findMany({
      where: eq(schema.eventSections.eventId, event.id),
      orderBy: (s, { asc }) => [asc(s.position), asc(s.id)],
    })
  );

  const parsed = buildAnswersSchema(sections).safeParse(body.answers);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Please check your answers (${first?.path.join(".")}: ${first?.message}).` },
      { status: 400 }
    );
  }
  const answers = parsed.data as Record<string, Record<string, unknown>>;

  // Per-option capacity on choice sections
  for (const section of sections) {
    if (section.kind !== "choice") continue;
    const cfg = section.config as SectionConfigMap["choice"];
    const answer = answers[String(section.id)] as { selected?: string | string[] } | undefined;
    if (!answer?.selected) continue;
    const picks = Array.isArray(answer.selected) ? answer.selected : [answer.selected];
    const counts = await choiceOptionCounts(event.id, section.id);
    for (const pick of picks) {
      const option = cfg.options.find((o) => o.id === pick);
      if (option?.capacity != null && (counts[pick] ?? 0) >= option.capacity) {
        return NextResponse.json(
          { error: `"${option.label}" is full — please choose another option.` },
          { status: 409 }
        );
      }
    }
  }

  const contact = extractContact(sections, answers);
  if (!contact) {
    return NextResponse.json(
      { error: "This event's form must collect your name and email." },
      { status: 400 }
    );
  }

  // Pricing (all recomputed server-side)
  const tiers = await db.query.priceTiers.findMany({
    where: eq(schema.priceTiers.eventId, event.id),
  });
  let totalCents = 0;
  let pricing: Record<string, unknown> = { tier: null, addOns: [], coupon: null, totalCents: 0 };
  let tierRow: (typeof tiers)[number] | null = null;
  let couponRow: typeof schema.coupons.$inferSelect | null = null;

  if (tiers.length > 0) {
    tierRow = tiers.find((t) => t.id === body.tierId) ?? null;
    if (!tierRow) {
      return NextResponse.json({ error: "Please select a registration option." }, { status: 400 });
    }
    const tierDTO = {
      id: tierRow.id,
      label: tierRow.label,
      amountCents: tierRow.amountCents,
      availableFrom: tierRow.availableFrom?.toISOString() ?? null,
      availableUntil: tierRow.availableUntil?.toISOString() ?? null,
    };
    if (!tierIsActive(tierDTO, new Date())) {
      return NextResponse.json(
        { error: "That registration option is no longer available." },
        { status: 409 }
      );
    }

    const selectedAddOns = await validateAddOnIds(event.id, body.addOnIds);
    if (selectedAddOns === null) {
      return NextResponse.json({ error: "Invalid add-on selection." }, { status: 400 });
    }

    if (body.couponCode) {
      const { error, coupon } = await findValidCoupon(event.id, body.couponCode);
      if (error) return NextResponse.json({ error }, { status: 400 });
      couponRow = coupon;
    }

    const result = computeTotal(
      tierDTO,
      selectedAddOns.map((a) => ({ id: a.id, label: a.label, amountCents: a.amountCents })),
      couponRow ? { id: couponRow.id, code: couponRow.code, type: couponRow.type, value: couponRow.value } : null
    );
    totalCents = result.totalCents;
    pricing = {
      tier: { id: tierRow.id, label: tierRow.label, amountCents: tierRow.amountCents },
      addOns: selectedAddOns.map((a) => ({ id: a.id, label: a.label, amountCents: a.amountCents })),
      coupon: couponRow
        ? { id: couponRow.id, code: couponRow.code, discountCents: result.discountCents }
        : null,
      totalCents,
    };
  }

  const [registration] = await db
    .insert(schema.registrations)
    .values({
      orgId: event.orgId,
      eventId: event.id,
      status: "pending",
      contactName: contact.name,
      contactEmail: contact.email,
      answers,
      tierId: tierRow?.id ?? null,
      couponId: couponRow?.id ?? null,
      pricing,
      amountCents: totalCents,
    })
    .returning();

  // Free registration: confirm immediately, no payment leg.
  if (totalCents === 0) {
    await confirmRegistration(registration.id);
    return NextResponse.json({ redirectUrl: `/register/confirmed?event=${event.slug}` });
  }

  const gateway = getGateway();
  const checkout = await gateway.createCheckout({
    registrationId: registration.id,
    amountCents: totalCents,
    currency: "aud",
    description: `${event.title} — ${contact.name}`,
  });

  await db.insert(schema.payments).values({
    orgId: event.orgId,
    registrationId: registration.id,
    kind: "charge",
    amountCents: totalCents,
    status: "pending",
    gateway: gateway.name,
    gatewayRef: checkout.gatewayRef,
  });

  return NextResponse.json({ redirectUrl: checkout.redirectUrl });
}
