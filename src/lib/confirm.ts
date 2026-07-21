import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "./email";
import { emailLayout, escapeHtml } from "./email-layout";
import { buildEventIcs } from "./ics";
import { formatCents } from "./pricing";

type Pricing = {
  tier: { label: string; amountCents: number } | null;
  addOns: { label: string; amountCents: number }[];
};

function formatDate(d: Date) {
  return d.toLocaleString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Confirm a registration: flip status and send the email.
export async function confirmRegistration(registrationId: number) {
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
  });
  if (!registration || registration.status === "confirmed") return;

  await db
    .update(schema.registrations)
    .set({ status: "confirmed" })
    .where(eq(schema.registrations.id, registrationId));

  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, registration.eventId),
  });

  await sendConfirmationEmail(registration, event);
  return event;
}

async function sendConfirmationEmail(
  registration: typeof schema.registrations.$inferSelect,
  event: typeof schema.events.$inferSelect | undefined
) {
  const pricing = (registration.pricing ?? {}) as Partial<Pricing>;
  const firstName = registration.contactName.split(" ")[0] || registration.contactName;
  const eventTitle = event?.title ?? "the event";

  // Plain-text details, mirrored in the HTML body below.
  const detailLines: string[] = [];
  if (event?.startsAt) detailLines.push(`When: ${formatDate(event.startsAt)}`);
  if (event?.location) detailLines.push(`Where: ${event.location}`);
  if (pricing.tier) detailLines.push(`Registration: ${pricing.tier.label}`);
  for (const a of pricing.addOns ?? []) detailLines.push(`Add-on: ${a.label}`);
  detailLines.push(`Amount: ${formatCents(registration.amountCents)}`);

  const text =
    `Hi ${firstName},\n\n` +
    `Your registration for ${eventTitle} is confirmed.\n\n` +
    detailLines.join("\n") +
    "\n\n" +
    (registration.reference
      ? `Your registration number is ${registration.reference}.\n` +
        `Please present this number at the event entrance.\n\n`
      : "") +
    `We look forward to seeing you there.`;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 0;color:#71717a;">${escapeHtml(label)}</td>` +
    `<td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(value)}</td></tr>`;

  const detailRows = [
    event?.startsAt ? row("When", formatDate(event.startsAt)) : "",
    event?.location ? row("Where", event.location) : "",
    pricing.tier ? row("Registration", pricing.tier.label) : "",
    ...(pricing.addOns ?? []).map((a) => row("Add-on", a.label)),
    row("Amount", formatCents(registration.amountCents)),
  ].join("");

  const ticketBlock = registration.reference
    ? `<div style="margin:20px 0;padding:16px;border:2px dashed #0f766e;border-radius:8px;text-align:center;background:#f0fdfa;">
         <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#0f766e;font-weight:600;">Your registration number</div>
         <div style="margin-top:6px;font-size:26px;font-weight:700;letter-spacing:2px;font-family:monospace;color:#134e4a;">${escapeHtml(
           registration.reference
         )}</div>
         <div style="margin-top:6px;font-size:13px;color:#0f766e;">Please present this at the event entrance.</div>
       </div>`
    : "";

  const bodyHtml =
    `<p style="margin:0 0 16px;">Hi ${escapeHtml(firstName)}, your registration for ` +
    `<strong>${escapeHtml(eventTitle)}</strong> is confirmed.</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">${detailRows}</table>` +
    ticketBlock +
    `<p style="margin:16px 0 0;color:#3f3f46;">We look forward to seeing you there. A calendar invitation is attached — tap it to add the event to your calendar.</p>`;

  // Calendar attachment, when we know when the event is.
  const attachments =
    event?.startsAt
      ? [
          {
            filename: "event.ics",
            contentType: "text/calendar",
            content: buildEventIcs({
              uid: `registration-${registration.id}@snsw-events`,
              title: eventTitle,
              start: event.startsAt,
              end: event.endsAt,
              location: event.location,
              description: event.description,
              // createdAt is a stable timestamp we already hold (no Date.now()).
              stampAt: registration.createdAt,
            }),
          },
        ]
      : undefined;

  await sendEmail({
    to: registration.contactEmail,
    subject: `Registration confirmed — ${eventTitle}`,
    text,
    html: emailLayout({ heading: "Registration confirmed", bodyHtml }),
    attachments,
  });
}
