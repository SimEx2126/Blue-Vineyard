import { db, schema } from "@/db";
import { sendEmail } from "./email";
import { emailLayout, escapeHtml } from "./email-layout";
import { formatCents } from "./pricing";

function baseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

/**
 * Sent as soon as someone registers for a paid event. Payment happens outside
 * the app, so this tells them how much, how to pay, and where to upload proof —
 * and makes clear their place is confirmed only once payment is received.
 */
export async function sendRegistrationReceivedEmail(
  registration: typeof schema.registrations.$inferSelect,
  event: typeof schema.events.$inferSelect | undefined
) {
  const firstName = registration.contactName.split(" ")[0] || registration.contactName;
  const eventTitle = event?.title ?? "the event";
  const amount = formatCents(registration.amountCents);
  const payUrl = `${baseUrl()}/pay/${registration.reference}`;
  const instructions = event?.paymentInstructions?.trim();

  const text =
    `Hi ${firstName},\n\n` +
    `We've received your registration for ${eventTitle}. Your place is held pending payment.\n\n` +
    `Amount due: ${amount}\n` +
    (registration.reference ? `Your reference: ${registration.reference}\n` : "") +
    "\n" +
    (instructions ? `How to pay:\n${instructions}\n\n` : "") +
    `After paying, please upload your proof here:\n${payUrl}\n\n` +
    `We'll email you again to confirm once your payment has been received.`;

  const instructionsHtml = instructions
    ? `<div style="margin:16px 0;padding:14px;border:1px solid #e4e4e7;border-radius:8px;background:#fafafa;">
         <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;">How to pay</div>
         <div style="margin-top:6px;white-space:pre-line;font-size:14px;">${escapeHtml(instructions)}</div>
       </div>`
    : "";

  const bodyHtml =
    `<p style="margin:0 0 12px;">Hi ${escapeHtml(firstName)}, we've received your registration for ` +
    `<strong>${escapeHtml(eventTitle)}</strong>. Your place is held pending payment.</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">` +
    `<tr><td style="padding:4px 0;color:#71717a;">Amount due</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(
      amount
    )}</td></tr>` +
    (registration.reference
      ? `<tr><td style="padding:4px 0;color:#71717a;">Your reference</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-weight:600;">${escapeHtml(
          registration.reference
        )}</td></tr>`
      : "") +
    `</table>` +
    instructionsHtml +
    `<p style="margin:16px 0 12px;">Once you've paid, upload your proof (a screenshot or your reference number):</p>` +
    `<a href="${payUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Upload proof of payment</a>` +
    `<p style="margin:18px 0 0;color:#71717a;font-size:13px;">We'll email you again to confirm once your payment has been received.</p>`;

  await sendEmail({
    to: registration.contactEmail,
    subject: `Registration received — ${eventTitle}`,
    text,
    html: emailLayout({ heading: "Registration received", bodyHtml }),
  });
}

// Convenience for callers that only hold the registration id.
export async function sendRegistrationReceivedById(registrationId: number) {
  const registration = await db.query.registrations.findFirst({
    where: (r, { eq }) => eq(r.id, registrationId),
  });
  if (!registration) return;
  const event = await db.query.events.findFirst({
    where: (e, { eq }) => eq(e.id, registration.eventId),
  });
  await sendRegistrationReceivedEmail(registration, event);
}
