"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema, authSchema } from "@/db";
import { requireAdmin } from "@/lib/access";
import { createInvitedAccount, sendSetPasswordEmail } from "@/lib/account-invite";

const USERS = "/admin/users";

function fail(message: string): never {
  redirect(`${USERS}?error=${encodeURIComponent(message)}`);
}

// The admin's organization, or fail. People are managed within one organization;
// a super-admin (orgId null) manages accounts from the organizations area, not
// this per-organization screen. `fail` returns `never`, so the result narrows
// to a concrete number for the caller.
function requireOrg(admin: { orgId: number | null }): number {
  if (admin.orgId == null) fail("Manage members from the organizations area.");
  return admin.orgId;
}

// Loads a target account and confirms it belongs to the admin's own
// organization. Cross-organization ids get the same "no longer exists" message
// as truly missing ones, so the screen never confirms an account exists in
// another organization.
async function targetInOrg(orgId: number, userId: string) {
  const target = await db.query.user.findFirst({ where: eq(authSchema.user.id, userId) });
  if (!target || target.orgId !== orgId) fail("That account no longer exists.");
  return target;
}

/**
 * Number of admins in one organization who can still sign in, excluding one
 * person. The last-admin guard is per organization: deactivating Org A's only
 * admin is blocked regardless of how many admins Org B has.
 */
async function otherActiveAdmins(excludingId: string, orgId: number) {
  const rows = await db
    .select({ id: authSchema.user.id })
    .from(authSchema.user)
    .where(
      and(
        eq(authSchema.user.role, "admin"),
        eq(authSchema.user.active, true),
        eq(authSchema.user.orgId, orgId),
        ne(authSchema.user.id, excludingId)
      )
    );
  return rows.length;
}

export async function createUser(fd: FormData) {
  const admin = await requireAdmin();
  // Accounts are created inside the admin's own organization.
  const orgId = requireOrg(admin);

  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(fd.get("role") ?? "organiser");

  if (!name || !email) fail("Name and email are required.");
  // "superadmin" is deliberately not offerable here — an organization admin
  // cannot mint a platform owner.
  if (!["admin", "organiser", "viewer"].includes(role)) fail("Unknown role.");

  const result = await createInvitedAccount({ name, email, role, orgId });
  if (!result.ok) fail(result.error);

  revalidatePath(USERS);
  redirect(`${USERS}?created=${encodeURIComponent(email)}`);
}

/** Re-send the set-password email, e.g. when the first one was missed. */
export async function resendSetPassword(userId: string) {
  const admin = await requireAdmin();
  const orgId = requireOrg(admin);
  const target = await targetInOrg(orgId, userId);
  await sendSetPasswordEmail(target.email);
  redirect(`${USERS}?sent=${encodeURIComponent(target.email)}`);
}

export async function setUserActive(userId: string, active: boolean) {
  const admin = await requireAdmin();
  const orgId = requireOrg(admin);

  if (userId === admin.id && !active) {
    fail("You cannot deactivate your own account.");
  }

  const target = await targetInOrg(orgId, userId);

  if (!active && target.role === "admin" && (await otherActiveAdmins(userId, orgId)) === 0) {
    fail("There must be at least one active administrator.");
  }

  await db.update(authSchema.user).set({ active }).where(eq(authSchema.user.id, userId));
  revalidatePath(USERS);
}

export async function setUserRole(userId: string, role: string) {
  const admin = await requireAdmin();
  const orgId = requireOrg(admin);
  if (!["admin", "organiser", "viewer"].includes(role)) fail("Unknown role.");

  if (userId === admin.id && role !== "admin") {
    fail("You cannot remove your own administrator access.");
  }

  const target = await targetInOrg(orgId, userId);

  if (target.role === "admin" && role !== "admin" && (await otherActiveAdmins(userId, orgId)) === 0) {
    fail("There must be at least one active administrator.");
  }

  await db.update(authSchema.user).set({ role }).where(eq(authSchema.user.id, userId));
  revalidatePath(USERS);
}

/** Hand an organiser's events to someone else, e.g. when they leave. */
export async function reassignEvents(fromUserId: string, toUserId: string) {
  const admin = await requireAdmin();
  const orgId = requireOrg(admin);
  // Both people must be in the admin's own organization, and only that
  // organization's events move — an admin cannot reassign another org's events.
  const from = await targetInOrg(orgId, fromUserId);
  const to = await targetInOrg(orgId, toUserId);

  await db
    .update(schema.events)
    .set({ ownerId: to.id })
    .where(and(eq(schema.events.ownerId, from.id), eq(schema.events.orgId, orgId)));

  revalidatePath(USERS);
  revalidatePath("/admin/events");
}
