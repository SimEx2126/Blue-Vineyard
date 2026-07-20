"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db, schema, authSchema } from "@/db";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/access";

const USERS = "/admin/users";

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
  const password = String(fd.get("password") ?? "");
  const role = String(fd.get("role") ?? "organiser");

  if (!name || !email) fail("Name and email are required.");
  if (password.length < 10) fail("The password must be at least 10 characters.");
  if (role !== "admin" && role !== "organiser") fail("Unknown role.");

  try {
    // autoSignIn is off in the auth config, so this creates the account
    // without swapping the signed-in admin into the new user's session.
    await auth.api.signUpEmail({ body: { name, email, password } });
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

  revalidatePath(USERS);
  redirect(`${USERS}?created=${encodeURIComponent(email)}`);
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
  if (role !== "admin" && role !== "organiser") fail("Unknown role.");

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
