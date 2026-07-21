import { eq, sql } from "drizzle-orm";
import { db, schema, authSchema } from "@/db";
import { requireSuperAdmin } from "@/lib/access";
import { createOrganization, createOrgAdmin } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const label = "block text-sm font-medium text-zinc-700";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; adminAdded?: string }>;
}) {
  await requireSuperAdmin();
  const { error, created, adminAdded } = await searchParams;

  const [orgs, eventCounts, memberCounts, admins] = await Promise.all([
    db.query.orgs.findMany({ orderBy: (o, { asc }) => [asc(o.name)] }),
    db
      .select({ orgId: schema.events.orgId, count: sql<number>`count(*)::int` })
      .from(schema.events)
      .groupBy(schema.events.orgId),
    db
      .select({ orgId: authSchema.user.orgId, count: sql<number>`count(*)::int` })
      .from(authSchema.user)
      .groupBy(authSchema.user.orgId),
    db
      .select({
        orgId: authSchema.user.orgId,
        name: authSchema.user.name,
        email: authSchema.user.email,
        active: authSchema.user.active,
        emailVerified: authSchema.user.emailVerified,
      })
      .from(authSchema.user)
      .where(eq(authSchema.user.role, "admin"))
      .orderBy(authSchema.user.name),
  ]);

  const eventsByOrg = new Map(eventCounts.map((c) => [c.orgId, c.count]));
  const membersByOrg = new Map(memberCounts.map((c) => [c.orgId, c.count]));
  const adminsByOrg = new Map<number, typeof admins>();
  for (const a of admins) {
    if (a.orgId == null) continue;
    const list = adminsByOrg.get(a.orgId) ?? [];
    list.push(a);
    adminsByOrg.set(a.orgId, list);
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Each organization is a separate tenant — its events, registrations, payments and people
          are visible only within it. Create one, then invite its first administrator.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}
      {created && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Organization <strong>{created}</strong> created. Add its first administrator below.
        </p>
      )}
      {adminAdded && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Administrator invited: <strong>{adminAdded}</strong>. We&apos;ve emailed them a link to set
          their own password.
        </p>
      )}

      <div className="space-y-4">
        {orgs.map((org) => {
          const orgAdmins = adminsByOrg.get(org.id) ?? [];
          return (
            <section key={org.id} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-zinc-200"
                    style={{ backgroundColor: org.brandColor ?? "#e4e4e7" }}
                    aria-hidden
                  />
                  <h2 className="text-lg font-semibold">{org.name}</h2>
                </div>
                <div className="text-sm text-zinc-500">
                  {eventsByOrg.get(org.id) ?? 0} events · {membersByOrg.get(org.id) ?? 0} people
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Administrators
                </h3>
                {orgAdmins.length === 0 ? (
                  <p className="mt-2 text-sm text-amber-700">
                    No administrator yet — invite one below so they can run this organization.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {orgAdmins.map((a) => (
                      <li key={a.email} className="flex items-center gap-2">
                        <span>{a.name}</span>
                        <span className="text-zinc-400">{a.email}</span>
                        {!a.active ? (
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                            Deactivated
                          </span>
                        ) : (
                          !a.emailVerified && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                              Awaiting setup
                            </span>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form
                action={createOrgAdmin.bind(null, org.id)}
                className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <label className={label}>
                  Admin name
                  <input name="name" required className={input} placeholder="Kelli Thomson Jones" />
                </label>
                <label className={label}>
                  Admin email
                  <input
                    type="email"
                    name="email"
                    required
                    className={input}
                    placeholder="name@example.org"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Invite admin
                </button>
              </form>
            </section>
          );
        })}
        {orgs.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No organizations yet. Create the first one below.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">New organization</h2>
        <p className="mt-1 text-sm text-zinc-500">
          A name and, optionally, a brand colour. You&apos;ll invite its administrator afterwards.
        </p>
        <form action={createOrganization} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Name
            <input name="name" required className={input} placeholder="Northern Region Events" />
          </label>
          <label className={label}>
            Brand colour
            <input name="brandColor" type="color" defaultValue="#0f766e" className={input} />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Create organization
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
