"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireSuperAdmin } from "@/lib/access";
import { createInvitedAccount } from "@/lib/account-invite";

const ORGS = "/admin/organizations";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function fail(message: string): never {
  redirect(`${ORGS}?error=${encodeURIComponent(message)}`);
}

/** Create a new organization (tenant). Super-admin only. */
export async function createOrganization(fd: FormData) {
  await requireSuperAdmin();
  const name = str(fd, "name");
  if (!name) fail("An organization name is required.");
  // A colour is optional; it is only ever branding, never trusted markup.
  const brandColor = str(fd, "brandColor");

  const [org] = await db
    .insert(schema.orgs)
    .values({ name, brandColor: brandColor ?? undefined })
    .returning();

  revalidatePath(ORGS);
  redirect(`${ORGS}?created=${encodeURIComponent(org.name)}`);
}

/**
 * Create the first (or an additional) administrator for an organization. The
 * account is stamped with that organization's id and invited through the same
 * set-password / email-verification flow every other account uses.
 */
export async function createOrgAdmin(orgId: number, fd: FormData) {
  await requireSuperAdmin();
  if (!Number.isInteger(orgId)) fail("Unknown organization.");

  const org = await db.query.orgs.findFirst({ where: eq(schema.orgs.id, orgId) });
  if (!org) fail("That organization no longer exists.");

  const name = str(fd, "name");
  const email = str(fd, "email")?.toLowerCase() ?? null;
  if (!name || !email) fail("The admin's name and email are required.");

  const result = await createInvitedAccount({ name, email, role: "admin", orgId });
  if (!result.ok) fail(result.error);

  revalidatePath(ORGS);
  redirect(`${ORGS}?adminAdded=${encodeURIComponent(email)}`);
}
