import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db, authSchema } from "@/db";
import { auth } from "./auth";

/**
 * Account invitation — the one place an account is created for someone else.
 *
 * An admin (or the platform super-admin) never picks a password. The account
 * is created with a random one nobody sees, then the person sets their own via
 * the emailed link — so no password is ever sent over chat or email, and
 * clicking the link both sets the password and verifies their address.
 *
 * Shared by the per-organization People screen and the super-admin's
 * "create an organization's first admin" flow, so both go through exactly the
 * same set-password / email-verification path.
 */

function baseUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Emails the person a link to set their own password. Also used as the
// "resend invite" action. Never throws into the caller — a transient mail
// failure must not blow up the surrounding request.
export async function sendSetPasswordEmail(email: string) {
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${baseUrl()}/admin/set-password` },
    });
  } catch (err) {
    console.error(`[account] could not send set-password email to ${email}:`, err);
  }
}

export type InvitedAccount = {
  name: string;
  email: string;
  role: string;
  orgId: number;
  // Present when an organiser invites a read-only assistant scoped to them.
  assistantOf?: string | null;
};

// Creates the account, stamps role/orgId/active (all input:false in the auth
// config, so they are set here rather than accepted from the sign-up payload),
// and sends the set-password email. Returns a plain result the caller maps to
// its own redirect/error UI, rather than redirecting from in here.
export async function createInvitedAccount(
  input: InvitedAccount
): Promise<{ ok: true } | { ok: false; error: string }> {
  const throwaway = randomBytes(24).toString("base64url");

  try {
    // autoSignIn is off in the auth config, so this creates the account without
    // swapping the signed-in creator into the new user's session.
    await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: throwaway },
    });
  } catch (err) {
    if (err instanceof APIError) {
      return {
        ok: false,
        error:
          err.body?.code === "USER_ALREADY_EXISTS"
            ? "An account with that email already exists."
            : (err.body?.message ?? "Could not create that account."),
      };
    }
    throw err;
  }

  const created = await db.query.user.findFirst({
    where: eq(authSchema.user.email, input.email),
  });
  if (!created) return { ok: false, error: "Could not create that account." };

  await db
    .update(authSchema.user)
    .set({
      role: input.role,
      orgId: input.orgId,
      active: true,
      assistantOf: input.assistantOf ?? null,
    })
    .where(eq(authSchema.user.id, created.id));

  await sendSetPasswordEmail(input.email);
  return { ok: true };
}
