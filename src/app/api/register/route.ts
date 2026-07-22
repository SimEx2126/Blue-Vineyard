import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getOpenState } from "@/lib/registration";
import { confirmRegistration } from "@/lib/confirm";
import { sendRegistrationReceivedEmail } from "@/lib/registration-email";
import { generateReference } from "@/lib/reference";

// The registration form is one fixed basic form (no per-event form builder):
// first/last name, email, age, gender, address, media consent, parent consent,
// and the parent/guardian's full name + number — who is automatically the
// emergency contact.
const bodySchema = z.object({
  eventId: z.number().int(),
  tierId: z.number().int().nullable(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  age: z.number().int().min(1).max(120),
  gender: z.enum(["male", "female"]),
  address: z.string().trim().min(1),
  mediaConsent: z.boolean().default(false),
  parentConsent: z.boolean().default(false),
  parentName: z.string().trim().min(1),
  parentPhone: z.string().trim().min(1),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Please fill in every field (name, email, age, gender, address and the parent/guardian's name and number)." },
      { status: 400 }
    );
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

  // Pricing (recomputed server-side). A free event has no payment leg at all,
  // whatever tiers may linger from when it was paid.
  let totalCents = 0;
  let pricing: Record<string, unknown> = { tier: null, totalCents: 0 };
  let tierRow: typeof schema.priceTiers.$inferSelect | null = null;

  if (event.requiresPayment) {
    const tiers = await db.query.priceTiers.findMany({
      where: eq(schema.priceTiers.eventId, event.id),
    });
    if (tiers.length > 0) {
      tierRow = tiers.find((t) => t.id === body.tierId) ?? null;
      if (!tierRow) {
        return NextResponse.json({ error: "Please select a registration option." }, { status: 400 });
      }
      totalCents = tierRow.amountCents;
      pricing = {
        tier: { id: tierRow.id, label: tierRow.label, amountCents: tierRow.amountCents },
        totalCents,
      };
    }
  }

  const [registration] = await db
    .insert(schema.registrations)
    .values({
      orgId: event.orgId,
      eventId: event.id,
      reference: generateReference(),
      status: "pending",
      contactName: [body.firstName, body.lastName].join(" "),
      contactEmail: body.email.toLowerCase(),
      phone: body.phone,
      gender: body.gender,
      age: body.age,
      address: body.address,
      mediaConsent: body.mediaConsent,
      parentName: body.parentName,
      parentPhone: body.parentPhone,
      parentConsent: body.parentConsent,
      tierId: tierRow?.id ?? null,
      pricing,
      amountCents: totalCents,
    })
    .returning();

  // Free registration: confirm immediately, no payment leg.
  if (totalCents === 0) {
    await confirmRegistration(registration.id);
    return NextResponse.json({ redirectUrl: `/register/confirmed?ref=${registration.reference}` });
  }

  // Paid: payment happens outside the app. Record a pending charge, email the
  // registrant how to pay and where to upload proof, and send them to the pay
  // page. An organiser confirms it later once the money arrives.
  await db.insert(schema.payments).values({
    orgId: event.orgId,
    registrationId: registration.id,
    kind: "charge",
    amountCents: totalCents,
    status: "pending",
    gateway: "manual",
  });

  await sendRegistrationReceivedEmail(registration, event);

  return NextResponse.json({ redirectUrl: `/pay/${registration.reference}` });
}
