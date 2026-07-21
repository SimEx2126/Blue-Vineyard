import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email delivery. Uses SMTP when the mail credentials are present, and falls
 * back to logging the message to the console in development so the app runs
 * (and can be tested) without them.
 *
 * Sending never throws into the caller: a registration or account action must
 * succeed even if the mail server is briefly unreachable — the failure is
 * logged, not surfaced as an error to the person registering.
 */

export type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_USERNAME && process.env.MAIL_PASSWORD);
}

function fromAddress() {
  return process.env.MAIL_SENDER || process.env.MAIL_USERNAME || "no-reply@localhost";
}

let transport: Transporter | null = null;

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 587 uses STARTTLS, negotiated automatically
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }
  return transport;
}

export async function sendEmail({ to, subject, text, html, attachments }: EmailInput) {
  if (!isEmailConfigured()) {
    console.log(
      `\n[email:console] to=${to}\n[email:console] subject=${subject}\n${text}\n` +
        (attachments?.length
          ? `[email:console] attachments: ${attachments.map((a) => a.filename).join(", ")}\n`
          : "")
    );
    return { delivered: false as const };
  }

  try {
    await getTransport().sendMail({ from: fromAddress(), to, subject, text, html, attachments });
    return { delivered: true as const };
  } catch (err) {
    console.error(`[email] failed to send to ${to}:`, err);
    return { delivered: false as const };
  }
}
