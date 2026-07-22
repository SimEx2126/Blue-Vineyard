import { redirect } from "next/navigation";
import { isSuperAdmin, requireUser } from "@/lib/access";

export const dynamic = "force-dynamic";

// The Dashboard was removed from the nav — /admin is just the post-login
// landing, so it forwards to each role's home screen.
export default async function AdminHome() {
  const user = await requireUser();
  redirect(isSuperAdmin(user) ? "/admin/organizations" : "/admin/events");
}
