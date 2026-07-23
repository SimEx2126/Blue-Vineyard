import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin, isSuperAdmin, isViewer, requireUser } from "@/lib/access";
import { AdminNav } from "@/components/AdminNav";
import { AccountMenu } from "@/components/AccountMenu";
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
        {/* The account menu: an avatar chip opens a dropdown with the identity
            and Sign out, keeping the bar itself to navigation. */}
        <AccountMenu name={user.name} initials={initials} badge={badge} logoutAction={logout} />
      </header>
      {children}
    </div>
  );
}
