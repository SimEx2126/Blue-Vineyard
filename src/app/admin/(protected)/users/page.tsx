import { sql } from "drizzle-orm";
import { db, schema, authSchema } from "@/db";
import { requireAdmin } from "@/lib/access";
import {
  createUser,
  reassignEvents,
  resendSetPassword,
  setUserActive,
  setUserRole,
} from "./actions";

export const dynamic = "force-dynamic";

const input =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const label = "block text-sm font-medium text-zinc-700";
const smallBtn =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; sent?: string }>;
}) {
  const admin = await requireAdmin();
  const { error, created, sent } = await searchParams;

  // Counted separately rather than as a correlated subquery: inside one,
  // Drizzle emits an unqualified "id" that Postgres binds to events.id.
  const [rows, eventCounts] = await Promise.all([
    db
      .select({
        id: authSchema.user.id,
        name: authSchema.user.name,
        email: authSchema.user.email,
        role: authSchema.user.role,
        active: authSchema.user.active,
        // Set true when they complete the set-password link, so it doubles as
        // "have they finished setting up their account?".
        emailVerified: authSchema.user.emailVerified,
        createdAt: authSchema.user.createdAt,
      })
      .from(authSchema.user)
      .orderBy(authSchema.user.name),
    db
      .select({
        ownerId: schema.events.ownerId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.events)
      .groupBy(schema.events.ownerId),
  ]);

  const countByOwner = new Map(eventCounts.map((c) => [c.ownerId, c.count]));
  const people = rows.map((r) => ({ ...r, eventCount: countByOwner.get(r.id) ?? 0 }));

  const activeOthers = people.filter((p) => p.active && p.id !== admin.id);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">People</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Organisers manage only the events they create. Administrators see every event and manage
          this list.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {created && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Account created for <strong>{created}</strong>. We&apos;ve emailed them a link to set their
          own password.
        </p>
      )}
      {sent && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Set-password email re-sent to <strong>{sent}</strong>.
        </p>
      )}

      {/* Scrolls sideways rather than clipping: the role and activation
          controls sit in the last columns. */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Events</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {people.map((p) => (
              <tr key={p.id} className={p.active ? "" : "bg-zinc-50 text-zinc-400"}>
                <td className="px-4 py-3 font-medium">
                  {p.name}
                  {p.id === admin.id && <span className="ml-2 text-xs text-zinc-400">(you)</span>}
                  {!p.active ? (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                      Deactivated
                    </span>
                  ) : (
                    !p.emailVerified && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                        Awaiting setup
                      </span>
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.email}</td>
                <td className="px-4 py-3">
                  <form action={setUserRole.bind(null, p.id, p.role === "admin" ? "organiser" : "admin")}>
                    <button
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.role === "admin"
                          ? "bg-teal-100 text-teal-800 hover:bg-teal-200"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                      title={
                        p.role === "admin" ? "Make an organiser" : "Make an administrator"
                      }
                    >
                      {p.role}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-right">{p.eventCount}</td>
                <td className="space-y-2 px-4 py-3 text-right">
                  {p.active && !p.emailVerified && (
                    <form action={resendSetPassword.bind(null, p.id)}>
                      <button className={smallBtn}>Resend setup email</button>
                    </form>
                  )}
                  <form action={setUserActive.bind(null, p.id, !p.active)}>
                    <button className={smallBtn}>{p.active ? "Deactivate" : "Reactivate"}</button>
                  </form>
                  {p.eventCount > 0 && activeOthers.length > 0 && (
                    <form
                      action={async (fd: FormData) => {
                        "use server";
                        await reassignEvents(p.id, String(fd.get("toUserId") ?? ""));
                      }}
                      className="flex items-center justify-end gap-1"
                    >
                      <select
                        name="toUserId"
                        defaultValue=""
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                      >
                        <option value="">Hand events to…</option>
                        {activeOthers
                          .filter((o) => o.id !== p.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>
                      <button className={smallBtn}>Move</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Add someone</h2>
        <p className="mt-1 text-sm text-zinc-500">
          They&apos;ll get an email with a link to set their own password — you don&apos;t need to
          choose one for them.
        </p>
        <form action={createUser} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Name
            <input name="name" required className={input} placeholder="Kelli Thomson Jones" />
          </label>
          <label className={label}>
            Email
            <input
              type="email"
              name="email"
              required
              className={input}
              placeholder="name@adventist.org.au"
            />
          </label>
          <label className={label}>
            Role
            <select name="role" defaultValue="organiser" className={input}>
              <option value="organiser">Organiser — their own events only</option>
              <option value="admin">Administrator — every event, and this list</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Create account
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
