// Email behind an interface: console driver in dev; wire Resend/SMTP in prod.

type EmailInput = { to: string; subject: string; text: string };

export async function sendEmail({ to, subject, text }: EmailInput) {
  // TODO: Resend/SMTP driver selected via env when credentials exist.
  console.log(`\n[email] to=${to}\n[email] subject=${subject}\n${text}\n`);
}
