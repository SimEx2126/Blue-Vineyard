import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin, requireUser } from "@/lib/access";
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
        <nav className="flex gap-5">
          <Link href="/admin" className="font-semibold hover:text-white">
            Dashboard
          </Link>
          <Link href="/admin/events" className="hover:text-white">
            Events
          </Link>
          <Link href="/admin/payments" className="hover:text-white">
            Payments
          </Link>
          {isAdmin(user) && (
            <Link href="/admin/users" className="hover:text-white">
              People
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-zinc-400">
            {user.name}
            {isAdmin(user) && (
              <span className="ml-2 rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Admin
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
