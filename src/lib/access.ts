import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "./auth";

/**
 * Authorisation. Better Auth answers "who is this?"; this file answers
 * "what may they see?".
 *
 * Registrant records hold medical details, doctor contacts and Medicare
 * numbers, so every admin read and write that takes an event id from the URL
 * must pass through assertCanEditEvent. A missed call leaks one ministry's
 * registrants to another.
 */

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  orgId: number | null;
  role: string;
  active: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as unknown as Partial<CurrentUser> & { id: string };

  // Checked per request rather than only at sign-in, so deactivating someone
  // takes effect immediately instead of when their session happens to expire.
  if (u.active === false) return null;

  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    orgId: u.orgId ?? null,
    role: u.role ?? "organiser",
    active: true,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  return user;
}

export function isAdmin(user: CurrentUser) {
  return user.role === "admin";
}

/**
 * Returns the event only when the signed-in user is an admin or owns it.
 * Anything else is a 404 rather than a 403, so an organiser cannot probe
 * which event ids exist.
 */
export async function assertCanEditEvent(eventId: number) {
  const user = await requireUser();
  if (!Number.isInteger(eventId)) notFound();
  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, eventId),
  });
  if (!event) notFound();
  if (!isAdmin(user) && event.ownerId !== user.id) notFound();
  return { event, user };
}
