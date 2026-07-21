import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq, type SQL } from "drizzle-orm";
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
 *
 * Tenancy: every account belongs to one organization (user.orgId), and an
 * event, its registrations and its payments belong to the same organization.
 * The boundary is enforced here — assertCanEditEvent / assertCanViewEvent
 * reject any event whose orgId differs from the caller's, and eventListWhere
 * scopes every list query. The one exception is the platform super-admin
 * (role "superadmin", orgId null), who sits above every organization.
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

// An organization admin: manages every event, payment and person within their
// own organization. Super-admin outranks them and passes this check too.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin" && !isSuperAdmin(user)) notFound();
  return user;
}

// The platform owner, above all organizations. Creates organizations and their
// first admin; may see across the tenant boundary. Has no orgId of their own.
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) notFound();
  return user;
}

export function isSuperAdmin(user: CurrentUser) {
  return user.role === "superadmin";
}

export function isAdmin(user: CurrentUser) {
  return user.role === "admin";
}

// A read-only caretaker who watches every event's submissions org-wide, e.g.
// covering while an admin is away. Never edits, refunds, or manages people.
export function isViewer(user: CurrentUser) {
  return user.role === "viewer";
}

// Who sees every event in their organization (not just their own) in the
// dashboard and events list. Organisers see only the events they own.
export function canViewAllEvents(user: CurrentUser) {
  return isSuperAdmin(user) || user.role === "admin" || user.role === "viewer";
}

// Who may create and own events. Viewers may not.
export function canManageEvents(user: CurrentUser) {
  return user.role === "admin" || user.role === "organiser";
}

/**
 * The WHERE clause for "which events may this user see in a list", combining
 * the tenant boundary with the role. Centralised so no list query has to
 * re-derive it (and risk forgetting the org scope):
 *   - super-admin: every event, every organization (no filter)
 *   - admin / viewer: every event in their own organization
 *   - organiser: only the events they own, within their organization
 * A user with no orgId who is not a super-admin can see nothing.
 */
export function eventListWhere(user: CurrentUser): SQL | undefined {
  if (isSuperAdmin(user)) return undefined;
  if (user.orgId == null) return eq(schema.events.id, -1); // matches nothing
  const inOrg = eq(schema.events.orgId, user.orgId);
  if (canViewAllEvents(user)) return inOrg;
  return and(inOrg, eq(schema.events.ownerId, user.id));
}

/**
 * Returns the event only when the signed-in user is an admin or owns it, and
 * the event belongs to their organization. Anything else is a 404 rather than
 * a 403, so a user cannot probe which event ids exist in another organization.
 * Every mutating path goes through here.
 */
export async function assertCanEditEvent(eventId: number) {
  const user = await requireUser();
  if (!Number.isInteger(eventId)) notFound();
  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, eventId),
  });
  if (!event) notFound();
  // Super-admin is above the tenant boundary; everyone else is confined to
  // their own organization, then further to admin-or-owner within it.
  if (!isSuperAdmin(user)) {
    if (event.orgId !== user.orgId) notFound();
    if (!isAdmin(user) && event.ownerId !== user.id) notFound();
  }
  return { event, user };
}

/**
 * Read access to one event's registrations: admins and viewers (org-wide),
 * plus the event's own organiser — all within the same organization. Returns
 * `canEdit` so a page can allow a viewer to look without exposing controls
 * that mutate.
 */
export async function assertCanViewEvent(eventId: number) {
  const user = await requireUser();
  if (!Number.isInteger(eventId)) notFound();
  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, eventId),
  });
  if (!event) notFound();
  if (isSuperAdmin(user)) return { event, user, canEdit: true };
  // Confined to their own organization first, then by role within it.
  if (event.orgId !== user.orgId) notFound();
  const canEdit = isAdmin(user) || event.ownerId === user.id;
  if (!canEdit && !isViewer(user)) notFound();
  return { event, user, canEdit };
}
