import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth";

async function logout() {
  "use server";
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <div className="mb-6 flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3 text-sm text-zinc-100">
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
        </nav>
        <form action={logout}>
          <button className="text-zinc-400 hover:text-white">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
