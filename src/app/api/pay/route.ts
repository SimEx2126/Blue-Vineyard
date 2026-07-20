import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { confirmRegistration } from "@/lib/confirm";

const bodySchema = z.object({ registrationId: z.number().int() });

// Fake-gateway "payment succeeded" callback. The Stripe equivalent of this
// logic will live in the Stripe webhook handler.
export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const payment = await db.query.payments.findFirst({
    where: and(
      eq(schema.payments.registrationId, body.registrationId),
      eq(schema.payments.kind, "charge"),
      eq(schema.payments.status, "pending")
    ),
  });
  if (!payment) {
    return NextResponse.json({ error: "No pending payment for this registration." }, { status: 404 });
  }

  await db
    .update(schema.payments)
    .set({ status: "paid" })
    .where(eq(schema.payments.id, payment.id));

  const event = await confirmRegistration(body.registrationId);

  return NextResponse.json({
    redirectUrl: `/register/confirmed${event ? `?event=${event.slug}` : ""}`,
  });
}
