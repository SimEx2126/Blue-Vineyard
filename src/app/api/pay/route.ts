import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { confirmRegistration } from "@/lib/confirm";
import { normaliseReference } from "@/lib/reference";

const bodySchema = z.object({ reference: z.string().min(1) });

/**
 * Dev-only stand-in for the payment gateway's webhook.
 *
 * It takes the registration's random reference rather than its row id, so a
 * caller must already hold the ticket code; with a sequential id anyone could
 * walk 1..N, mark other people's registrations paid, and harvest their ticket
 * references. Stripe's signature-verified webhook replaces this entirely.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const reference = normaliseReference(body.reference);
  if (!reference) return NextResponse.json({ error: "Invalid reference." }, { status: 400 });

  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.reference, reference),
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const payment = await db.query.payments.findFirst({
    where: and(
      eq(schema.payments.registrationId, registration.id),
      eq(schema.payments.kind, "charge"),
      eq(schema.payments.status, "pending")
    ),
  });
  if (!payment) {
    return NextResponse.json(
      { error: "No pending payment for this registration." },
      { status: 404 }
    );
  }

  await db
    .update(schema.payments)
    .set({ status: "paid" })
    .where(eq(schema.payments.id, payment.id));

  await confirmRegistration(registration.id);

  return NextResponse.json({ redirectUrl: `/register/confirmed?ref=${reference}` });
}
