import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

/**
 * Sign-up is reachable from the server (admin creating an account, seeding)
 * but not from the open internet — without it, anyone could POST to
 * /api/auth/sign-up/email and give themselves an organiser account.
 */
export async function POST(request: Request) {
  if (new URL(request.url).pathname.includes("/sign-up")) {
    const session = await auth.api.getSession({ headers: request.headers });
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "admin") {
      return new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  return handlers.POST(request);
}
