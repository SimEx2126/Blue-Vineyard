import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db, authSchema } from "@/db";
import { auth } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    // nextCookies() in the auth config sets the session cookie from here.
    await auth.api.signInEmail({ body: { email, password } });
  } catch (err) {
    // One message for every failure — distinguishing "no such account" from
    // "wrong password" would turn this form into an account-enumeration tool.
    if (err instanceof APIError) redirect("/admin/login?error=1");
    throw err;
  }

  // A deactivated account would otherwise sign in successfully and then be
  // bounced straight back here by the per-request check, which reads as a
  // broken login rather than a closed account.
  const account = await db.query.user.findFirst({
    where: eq(authSchema.user.email, email),
    columns: { active: true },
  });
  if (account && account.active === false) {
    await auth.api.signOut({ headers: await headers() });
    redirect("/admin/login?error=inactive");
  }

  redirect("/admin");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const input =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Admin sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sign in to manage your events and registrations.
        </p>
        <form action={login} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input type="email" name="email" required autoFocus className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Password</span>
            <input type="password" name="password" required className={input} />
          </label>
          {error === "inactive" ? (
            <p className="text-sm text-red-600">
              This account has been deactivated. Contact the conference office.
            </p>
          ) : (
            error && <p className="text-sm text-red-600">Incorrect email or password.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-xs text-zinc-500">
          Accounts are created by a conference administrator.
        </p>
      </div>
    </div>
  );
}
