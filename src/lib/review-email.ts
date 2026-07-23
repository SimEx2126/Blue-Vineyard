import { schema } from "@/db";
import { sendEmail } from "./email";
import { emailLayout, escapeHtml } from "./email-layout";

function baseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

/**
 * Invites a participant to review an event once it is over. The link carries
 * their ticket reference, which is the capability to leave the review — no
 * account needed, mirroring the payment and confirmation emails.
 */
export async function sendReviewInviteEmail(
  registration: typeof schema.registrations.$inferSelect,
  event: typeof schema.events.$inferSelect
) {
  if (!registration.reference) return { delivered: false };
  const firstName = registration.contactName.split(" ")[0] || registration.contactName;
  const reviewUrl = `${baseUrl()}/review/${registration.reference}`;

  const text =
    `Hi ${firstName},\n\n` +
    `Thanks for coming to ${event.title}. We'd love to hear how it went.\n\n` +
    `Leave a quick star rating here:\n${reviewUrl}\n\n` +
    `It only takes a moment and helps us plan future events.`;

  const bodyHtml =
    `<p style="margin:0 0 12px;">Hi ${escapeHtml(firstName)}, thanks for coming to ` +
    `<strong>${escapeHtml(event.title)}</strong>. We'd love to hear how it went.</p>` +
    `<p style="margin:0 0 18px;">It only takes a moment and helps us plan future events.</p>` +
    `<a href="${reviewUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Leave a review</a>`;

  return sendEmail({
    to: registration.contactEmail,
    subject: `How was ${event.title}?`,
    text,
    html: emailLayout({ heading: "How was the event?", bodyHtml }),
  });
}
