// Creates the platform super-admin — the account above every organization,
// which creates organizations and invites their first administrators.
//
// The super-admin is bootstrapped out-of-band (like the very first admin used
// to be): there is no in-app screen to mint one, by design. Idempotent — an
// existing account with this email is promoted rather than duplicated.
//
// Usage: npm run db:seed-superadmin
import "./load-env";
import { eq } from "drizzle-orm";
import { db, authSchema } from "./index";
import { auth } from "../lib/auth";

const EMAIL = process.env.SUPERADMIN_EMAIL ?? "superadmin@example.org";
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "superadmin12345";
const NAME = "Platform Owner";

async function main() {
  let record = await db.query.user.findFirst({
    where: eq(authSchema.user.email, EMAIL),
  });

  if (!record) {
    await auth.api.signUpEmail({ body: { name: NAME, email: EMAIL, password: PASSWORD } });
    record = await db.query.user.findFirst({ where: eq(authSchema.user.email, EMAIL) });
    if (!record) throw new Error(`Failed to create ${EMAIL}`);
    console.log(`Created super-admin: ${EMAIL} / ${PASSWORD}`);
  } else {
    console.log(`Exists, promoting to super-admin: ${EMAIL}`);
  }

  // Super-admin floats above organizations, so orgId is null. emailVerified is
  // set so the bootstrap account can sign in without the set-password email.
  await db
    .update(authSchema.user)
    .set({ role: "superadmin", orgId: null, emailVerified: true, active: true })
    .where(eq(authSchema.user.id, record.id));

  console.log("Super-admin ready. Sign in, then create organizations under /admin/organizations.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
