import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin, isSuperAdmin, isViewer, requireUser } from "@/lib/access";
import { AdminNav } from "@/components/AdminNav";
import { Brand } from "@/components/Brand";
import { headers } from "next/headers";

async function logout() {
  "use server";
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}

// The role shown in the account menu: label + the badge colour used elsewhere.
function roleBadge(user: Awaited<ReturnType<typeof requireUser>>) {
  if (isSuperAdmin(user)) return { label: "Super-admin", cls: "bg-amber-600" };
  if (isAdmin(user)) return { label: "Admin", cls: "bg-teal-600" };
  if (isViewer(user)) return { label: "Viewer", cls: "bg-zinc-500" };
  return { label: "Organiser", cls: "bg-zinc-500" };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const badge = roleBadge(user);
  // Initials for the avatar chip — first letters of up to two words.
  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div>
      <header className="sticky top-4 z-30 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-800 px-3 py-2.5 shadow-lg ring-1 ring-white/10">
        {/* Admin routes hide the public header, so the brand lives here. */}
        <div className="hidden shrink-0 pl-1 pr-1 md:block">
          <Brand href="/admin/events" tone="dark" subtitle={null} />
        </div>
        <span className="hidden h-8 w-px bg-white/10 md:block" />
        <AdminNav
          items={
            // The super-admin works above every organization, so they get one
            // screen — Organizations — not the per-organization sections.
            isSuperAdmin(user)
              ? [{ href: "/admin/organizations", label: "Organizations" }]
              : [
                  { href: "/admin/events", label: "Events" },
                  // Viewers watch submissions only — no payments ledger.
                  ...(isViewer(user) ? [] : [{ href: "/admin/payments", label: "Payments" }]),
                  // Organisers manage their own read-only assistants.
                  ...(user.role === "organiser"
                    ? [{ href: "/admin/assistants", label: "Assistants" }]
                    : []),
                  // People is admin-only, and the page itself enforces that too.
                  ...(isAdmin(user) ? [{ href: "/admin/users", label: "People" }] : []),
                ]
          }
        />
        {/* The account menu: an avatar chip opens a small dropdown holding the
            identity and Sign out, keeping the bar itself to navigation. A no-JS
            <details> so the layout stays a server component. */}
        <details className="group relative ml-auto">
          <summary className="flex cursor-pointer select-none list-none items-center gap-2 rounded-full py-1 pl-1 pr-2 text-zinc-200 transition hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white ring-2 ring-white/10">
              {initials}
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">
              {user.name}
            </span>
            <svg
              className="h-3.5 w-3.5 text-zinc-400 transition group-open:rotate-180"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-zinc-900">{user.name}</p>
              <span
                className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${badge.cls}`}
              >
                {badge.label}
              </span>
            </div>
            <form action={logout}>
              <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </details>
      </header>
      {children}
    </div>
  );
}
