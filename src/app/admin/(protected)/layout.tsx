import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin, isSuperAdmin, isViewer, requireUser } from "@/lib/access";
import { AdminNav } from "@/components/AdminNav";
import { headers } from "next/headers";

async function logout() {
  "use server";
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-900 px-4 py-3 text-sm text-zinc-100">
        <AdminNav
          items={
            // The super-admin works above every organization, so they get one
            // screen — Organizations — not the per-organization sections.
            isSuperAdmin(user)
              ? [{ href: "/admin/organizations", label: "Organizations" }]
              : [
                  { href: "/admin", label: "Dashboard" },
                  { href: "/admin/events", label: "Events" },
                  // Viewers watch submissions only — no payments ledger.
                  ...(isViewer(user) ? [] : [{ href: "/admin/payments", label: "Payments" }]),
                  // People is admin-only, and the page itself enforces that too.
                  ...(isAdmin(user) ? [{ href: "/admin/users", label: "People" }] : []),
                ]
          }
        />
        <div className="flex items-center gap-4">
          <span className="text-zinc-400">
            {user.name}
            {isSuperAdmin(user) && (
              <span className="ml-2 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Super-admin
              </span>
            )}
            {isAdmin(user) && (
              <span className="ml-2 rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Admin
              </span>
            )}
            {isViewer(user) && (
              <span className="ml-2 rounded bg-zinc-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Viewer
              </span>
            )}
          </span>
          <form action={logout}>
            <button className="text-zinc-400 hover:text-white">Sign out</button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
