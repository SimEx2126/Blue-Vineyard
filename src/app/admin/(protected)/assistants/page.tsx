import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, authSchema } from "@/db";
import { requireUser } from "@/lib/access";
import { inviteAssistant, resendAssistantInvite, setAssistantActive } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const label = "block text-sm font-medium text-zinc-700";
const smallBtn =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100";

export default async function AssistantsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; sent?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "organiser") notFound();
  const { error, created, sent } = await searchParams;

  const assistants = await db.query.user.findMany({
    where: eq(authSchema.user.assistantOf, user.id),
    orderBy: (u, { asc }) => [asc(u.name)],
  });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Assistants</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Give someone read-only access to your events: they can open your registrations and see
          who signed up, but they cannot edit anything or see other organisers&rsquo; events.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {created && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Assistant invited: <strong>{created}</strong>. We&rsquo;ve emailed them a link to set
          their own password.
        </p>
      )}
      {sent && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Set-password email re-sent to <strong>{sent}</strong>.
        </p>
      )}

      <div className="space-y-3">
        {assistants.map((a) => (
          <div
            key={a.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
              a.active ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50 text-zinc-400"
            }`}
          >
            <div>
              <p className="font-medium">
                {a.name}
                {!a.active ? (
                  <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                    Access off
                  </span>
                ) : (
                  !a.emailVerified && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      Awaiting setup
                    </span>
                  )
                )}
              </p>
              <p className="text-sm text-zinc-500">{a.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {a.active && !a.emailVerified && (
                <form action={resendAssistantInvite.bind(null, a.id)}>
                  <button className={smallBtn}>Resend invite</button>
                </form>
              )}
              <form action={setAssistantActive.bind(null, a.id, !a.active)}>
                <button className={smallBtn}>{a.active ? "Turn off access" : "Restore access"}</button>
              </form>
            </div>
          </div>
        ))}
        {assistants.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No assistants yet — invite one below.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Invite an assistant</h2>
        <p className="mt-1 text-sm text-zinc-500">
          They&rsquo;ll get an email with a link to set their own password.
        </p>
        <form action={inviteAssistant} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Name
            <input name="name" required className={input} />
          </label>
          <label className={label}>
            Email
            <input type="email" name="email" required className={input} />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Send invite
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
