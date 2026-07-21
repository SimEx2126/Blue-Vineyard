// One-off: confirm Wasabi + SMTP credentials are loaded and working, without
// printing any secret. Safe to delete afterwards.
import "../src/db/load-env";
import nodemailer from "nodemailer";
import { isStorageConfigured } from "../src/lib/storage";
import { isEmailConfigured } from "../src/lib/email";

async function main() {
  console.log("Wasabi configured:", isStorageConfigured());
  console.log("Email configured :", isEmailConfigured());
  console.log("Mail sender      :", process.env.MAIL_SENDER || "(unset)");

  if (isEmailConfigured()) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
    });
    try {
      await t.verify();
      console.log("SMTP auth        : OK (server accepted the login)");
    } catch (err) {
      console.log("SMTP auth        : FAILED —", (err as Error).message);
    }
  }
  process.exit(0);
}

main();
