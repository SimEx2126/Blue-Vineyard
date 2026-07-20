import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type SessionData = { admin?: boolean };

export async function getSession() {
  const store = await cookies();
  return getIronSession<SessionData>(store, {
    cookieName: "ae_admin",
    password: process.env.SESSION_SECRET!,
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
  });
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.admin) redirect("/admin/login");
}
