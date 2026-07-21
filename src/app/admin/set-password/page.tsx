import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { db, authSchema } from "@/db";

async function setPassword(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) redirect("/admin/set-password?error=missing");
  if (password.length < 10) {
    redirect(`/admin/set-password?token=${encodeURIComponent(token)}&error=short`);
  }
  if (password !== confirm) {
    redirect(`/admin/set-password?token=${encodeURIComponent(token)}&error=mismatch`);
  }

  // Read who this token belongs to before the reset consumes it. Better Auth
  // stores the reset token as identifier `reset-password:<token>`, value = userId.
  const pending = await db.query.verification.findFirst({
    where: eq(authSchema.verification.identifier, `reset-password:${token}`),
  });

  try {
    await auth.api.resetPassword({ body: { token, newPassword: password } });
  } catch (err) {
    if (err instanceof APIError) {
      // A used or expired link lands here.
      redirect(`/admin/set-password?token=${encodeURIComponent(token)}&error=invalid`);
    }
    throw err;
  }

  // Completing a link sent to their address proves they control it.
  if (pending?.value) {
    await db
      .update(authSchema.user)
      .set({ emailVerified: true })
      .where(eq(authSchema.user.id, pending.value));
  }

  redirect("/admin/login?setup=done");
}

const ERRORS: Record<string, string> = {
  missing: "This link is missing its token. Please use the link from your email.",
  short: "The password must be at least 10 characters.",
  mismatch: "The two passwords do not match.",
  invalid: "This link has expired or was already used. Ask an administrator to resend it.",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const input =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

  if (!token) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          This page needs the link from your set-password email. Please open that link, or ask an
          administrator to resend it.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Set your password</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose a password for your SNSW Events organiser account.
        </p>
        <form action={setPassword} className="mt-5 space-y-4">
          <input type="hidden" name="token" value={token} />
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">New password</span>
            <input type="password" name="password" required minLength={10} autoFocus className={input} />
            <span className="mt-1 block text-xs text-zinc-500">At least 10 characters.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Confirm password</span>
            <input type="password" name="confirm" required minLength={10} className={input} />
          </label>
          {error && <p className="text-sm text-red-600">{ERRORS[error] ?? "Something went wrong."}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Set password
          </button>
        </form>
        <p className="mt-4 text-xs text-zinc-500">
          <Link href="/admin/login" className="hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
