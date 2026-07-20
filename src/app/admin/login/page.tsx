import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const password = formData.get("password");
  if (typeof password !== "string" || password !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login?error=1");
  }
  const session = await getSession();
  session.admin = true;
  await session.save();
  redirect("/admin");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Admin sign in</h1>
        <form action={login} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Password</span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </label>
          {error && <p className="text-sm text-red-600">Incorrect password.</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
