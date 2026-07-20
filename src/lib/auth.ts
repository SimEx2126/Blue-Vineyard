import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";

/**
 * Authentication is delegated to Better Auth — sessions, password hashing,
 * and (later) password reset and social sign-in.
 *
 * Authorisation is *not* handled here. Who may see which event's registrants
 * lives in src/lib/access.ts, because it depends on event ownership rather
 * than on identity alone.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Sign-up stays enabled so the server-side API can create accounts, but
    // the public /api/auth/sign-up endpoint is gated to admins in the route
    // handler — there is no outbound mail yet, so nobody self-registers.
    disableSignUp: false,
    // Critical: without this, an admin creating an account would be issued
    // the new user's session and silently swapped into their identity.
    autoSignIn: false,
  },
  user: {
    additionalFields: {
      // Which conference/church this person belongs to.
      orgId: { type: "number", required: false, input: false },
      // admin sees every event and manages users; organiser sees their own.
      role: { type: "string", required: false, defaultValue: "organiser", input: false },
      // Deactivated people keep their events but cannot sign in. Checked on
      // every request, so an existing session stops working immediately.
      active: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  // Must be last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});
