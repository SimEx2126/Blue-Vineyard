import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "./email";
import { formatCents } from "./pricing";

// Confirm a registration: flip status, count coupon use, send the email.
export async function confirmRegistration(registrationId: number) {
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
  });
  if (!registration || registration.status === "confirmed") return;
  await db
    .update(schema.registrations)
    .set({ status: "confirmed" })
    .where(eq(schema.registrations.id, registrationId));
  if (registration.couponId) {
    const coupon = await db.query.coupons.findFirst({
      where: eq(schema.coupons.id, registration.couponId),
    });
    if (coupon) {
      await db
        .update(schema.coupons)
        .set({ uses: coupon.uses + 1 })
        .where(eq(schema.coupons.id, coupon.id));
    }
  }
  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, registration.eventId),
  });
  await sendEmail({
    to: registration.contactEmail,
    subject: `Registration confirmed — ${event?.title ?? "Event"}`,
    text:
      `Hi ${registration.contactName},\n\n` +
      `Your registration for ${event?.title ?? "the event"} is confirmed.\n` +
      `Amount: ${formatCents(registration.amountCents)}\n\n` +
      `We look forward to seeing you there.`,
  });
  return event;
}
