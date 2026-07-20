// Creates the admin and organiser accounts, and assigns event ownership.
// Idempotent: existing accounts are left alone.
//
// Run with the dev server NOT required — Better Auth's server API is called
// directly. Passwords are hashed by Better Auth, never stored here.
import "./load-env";
import { eq } from "drizzle-orm";
import { db, schema, authSchema } from "./index";
import { auth } from "../lib/auth";

type Seed = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "organiser";
  ownsSlugs: string[];
};

const PEOPLE: Seed[] = [
  {
    name: "Conference Office",
    email: "admin@example.org",
    password: "admin12345",
    role: "admin",
    ownsSlugs: [],
  },
  {
    name: "Women's Ministries Leader",
    email: "womens@example.org",
    password: "organiser12345",
    role: "organiser",
    ownsSlugs: ["2026-womens-retreat-demo"],
  },
  {
    name: "Youth Director",
    email: "youth@example.org",
    password: "organiser12345",
    role: "organiser",
    ownsSlugs: ["2026-youth-summit-demo", "2027-pathfinder-camporee-demo"],
  },
];

async function main() {
  const org = await db.query.orgs.findFirst();
  if (!org) throw new Error("No org found — run `npm run db:seed` first.");

  for (const person of PEOPLE) {
    let record = await db.query.user.findFirst({
      where: eq(authSchema.user.email, person.email),
    });

    if (!record) {
      await auth.api.signUpEmail({
        body: { name: person.name, email: person.email, password: person.password },
      });
      record = await db.query.user.findFirst({
        where: eq(authSchema.user.email, person.email),
      });
      if (!record) throw new Error(`Failed to create ${person.email}`);
      console.log(`Created ${person.role}: ${person.email} / ${person.password}`);
    } else {
      console.log(`Exists: ${person.email}`);
    }

    // role and orgId are input:false, so they are set here rather than at signup.
    await db
      .update(authSchema.user)
      .set({ role: person.role, orgId: org.id })
      .where(eq(authSchema.user.id, record.id));

    for (const slug of person.ownsSlugs) {
      await db
        .update(schema.events)
        .set({ ownerId: record.id })
        .where(eq(schema.events.slug, slug));
    }
  }

  const events = await db.query.events.findMany({ columns: { slug: true, ownerId: true } });
  console.log("\nEvent ownership:");
  for (const e of events) console.log(`  ${e.slug} -> ${e.ownerId ?? "(unowned)"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
