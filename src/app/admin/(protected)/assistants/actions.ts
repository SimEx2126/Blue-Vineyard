"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, authSchema } from "@/db";
import { requireUser, type CurrentUser } from "@/lib/access";
import { createInvitedAccount, sendSetPasswordEmail } from "@/lib/account-invite";

const ASSISTANTS = "/admin/assistants";

// Assistants belong to an organiser. Admins manage people from the People
// screen instead, so this area is organiser-only.
async function requireOrganiser(): Promise<CurrentUser & { orgId: number }> {
  const user = await requireUser();
  if (user.role !== "organiser" || user.orgId == null) notFound();
  return user as CurrentUser & { orgId: number };
}

function fail(message: string): never {
  redirect(`${ASSISTANTS}?error=${encodeURIComponent(message)}`);
}

// Loads an assistant and confirms they belong to this organiser. Anyone
// else's account gets the same "no longer exists" as a truly missing one.
async function ownAssistant(organiserId: string, userId: string) {
  const target = await db.query.user.findFirst({ where: eq(authSchema.user.id, userId) });
  if (!target || target.assistantOf !== organiserId) fail("That assistant no longer exists.");
  return target;
}

/** Invite a read-only assistant scoped to this organiser's events. */
export async function inviteAssistant(fd: FormData) {
  const organiser = await requireOrganiser();

  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!name || !email) fail("Name and email are required.");

  const result = await createInvitedAccount({
    name,
    email,
    role: "viewer",
    orgId: organiser.orgId,
    assistantOf: organiser.id,
  });
  if (!result.ok) fail(result.error);

  revalidatePath(ASSISTANTS);
  redirect(`${ASSISTANTS}?created=${encodeURIComponent(email)}`);
}

/** Re-send the set-password email. */
export async function resendAssistantInvite(userId: string) {
  const organiser = await requireOrganiser();
  const target = await ownAssistant(organiser.id, userId);
  await sendSetPasswordEmail(target.email);
  redirect(`${ASSISTANTS}?sent=${encodeURIComponent(target.email)}`);
}

/** Turn an assistant's access off or back on. */
export async function setAssistantActive(userId: string, active: boolean) {
  const organiser = await requireOrganiser();
  await ownAssistant(organiser.id, userId);
  await db
    .update(authSchema.user)
    .set({ active })
    .where(and(eq(authSchema.user.id, userId), eq(authSchema.user.assistantOf, organiser.id)));
  revalidatePath(ASSISTANTS);
}
