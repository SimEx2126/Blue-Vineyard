"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db, schema, authSchema } from "@/db";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/access";

const USERS = "/admin/users";

function baseUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Emails the person a link to set their own password. Used on account creation
// and by the "resend" action. Never throws into the caller.
async function sendSetPasswordEmail(email: string) {
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${baseUrl()}/admin/set-password` },
    });
  } catch (err) {
    console.error(`[account] could not send set-password email to ${email}:`, err);
  }
}

function fail(message: string): never {
  redirect(`${USERS}?error=${encodeURIComponent(message)}`);
}

/** Number of admins who can still sign in, excluding one person. */
async function otherActiveAdmins(excludingId: string) {
  const rows = await db
    .select({ id: authSchema.user.id })
    .from(authSchema.user)
    .where(
      and(
        eq(authSchema.user.role, "admin"),
        eq(authSchema.user.active, true),
        ne(authSchema.user.id, excludingId)
      )
    );
  return rows.length;
}

export async function createUser(fd: FormData) {
  const admin = await requireAdmin();

  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(fd.get("role") ?? "organiser");

  if (!name || !email) fail("Name and email are required.");
  if (!["admin", "organiser", "viewer"].includes(role)) fail("Unknown role.");

  // The admin no longer picks a password. The account is created with a random
  // one nobody sees, then the person sets their own via the emailed link — so
  // they never receive a password over chat/email, and clicking the link both
  // sets the password and verifies their address.
  const throwaway = randomBytes(24).toString("base64url");

  try {
    // autoSignIn is off in the auth config, so this creates the account
    // without swapping the signed-in admin into the new user's session.
    await auth.api.signUpEmail({ body: { name, email, password: throwaway } });
  } catch (err) {
    if (err instanceof APIError) {
      fail(
        err.body?.code === "USER_ALREADY_EXISTS"
          ? "An account with that email already exists."
          : (err.body?.message ?? "Could not create that account.")
      );
    }
    throw err;
  }

  const created = await db.query.user.findFirst({
    where: eq(authSchema.user.email, email),
  });
  if (!created) fail("Could not create that account.");

  // role, orgId and active are input:false, so they are set here rather than
  // being accepted from the sign-up payload.
  await db
    .update(authSchema.user)
    .set({ role, orgId: admin.orgId, active: true })
    .where(eq(authSchema.user.id, created.id));

  await sendSetPasswordEmail(email);

  revalidatePath(USERS);
  redirect(`${USERS}?created=${encodeURIComponent(email)}`);
}

/** Re-send the set-password email, e.g. when the first one was missed. */
export async function resendSetPassword(userId: string) {
  await requireAdmin();
  const target = await db.query.user.findFirst({ where: eq(authSchema.user.id, userId) });
  if (!target) fail("That account no longer exists.");
  await sendSetPasswordEmail(target.email);
  redirect(`${USERS}?sent=${encodeURIComponent(target.email)}`);
}

export async function setUserActive(userId: string, active: boolean) {
  const admin = await requireAdmin();

  if (userId === admin.id && !active) {
    fail("You cannot deactivate your own account.");
  }

  const target = await db.query.user.findFirst({ where: eq(authSchema.user.id, userId) });
  if (!target) fail("That account no longer exists.");

  if (!active && target.role === "admin" && (await otherActiveAdmins(userId)) === 0) {
    fail("There must be at least one active administrator.");
  }

  await db.update(authSchema.user).set({ active }).where(eq(authSchema.user.id, userId));
  revalidatePath(USERS);
}

export async function setUserRole(userId: string, role: string) {
  const admin = await requireAdmin();
  if (!["admin", "organiser", "viewer"].includes(role)) fail("Unknown role.");

  if (userId === admin.id && role !== "admin") {
    fail("You cannot remove your own administrator access.");
  }

  const target = await db.query.user.findFirst({ where: eq(authSchema.user.id, userId) });
  if (!target) fail("That account no longer exists.");

  if (target.role === "admin" && role !== "admin" && (await otherActiveAdmins(userId)) === 0) {
    fail("There must be at least one active administrator.");
  }

  await db.update(authSchema.user).set({ role }).where(eq(authSchema.user.id, userId));
  revalidatePath(USERS);
}

/** Hand an organiser's events to someone else, e.g. when they leave. */
export async function reassignEvents(fromUserId: string, toUserId: string) {
  await requireAdmin();
  const target = await db.query.user.findFirst({ where: eq(authSchema.user.id, toUserId) });
  if (!target) fail("Choose someone to hand the events to.");

  await db
    .update(schema.events)
    .set({ ownerId: toUserId })
    .where(eq(schema.events.ownerId, fromUserId));

  revalidatePath(USERS);
  revalidatePath("/admin/events");
}
