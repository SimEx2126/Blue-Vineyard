// Adds a spread of church events across different ministries. Idempotent: an
// event whose slug already exists is left alone.
import "./load-env";
import { eq } from "drizzle-orm";
import { db, schema, authSchema } from "./index";
import { auth } from "../lib/auth";

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY);

type Tier = { label: string; amountCents: number };

type EventSpec = {
  slug: string;
  title: string;
  category: string;
  location: string;
  heroImageUrl: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  closesAt: Date;
  capacity: number;
  fullMessage: string;
  ownerEmail: string;
  tiers: Tier[];
};

const EVENTS: EventSpec[] = [
  {
    slug: "2026-choristers-festival",
    title: "2026 Choristers' Festival",
    category: "Music",
    location: "Wagga Wagga, NSW",
    heroImageUrl: "/demo-banners/choristers-festival.svg",
    description:
      "A weekend of massed choir singing, workshops and a Sabbath afternoon concert.\n\n" +
      "Singers from every church across the conference are welcome — you do not need to read music, " +
      "but you will need to know your part. Music packs are posted out four weeks beforehand.",
    startsAt: at(54),
    endsAt: at(55),
    closesAt: at(47),
    capacity: 120,
    fullMessage: "The massed choir is full. Please contact the music department to be added to the reserve list.",
    ownerEmail: "music@example.org",
    tiers: [
      { label: "Singer", amountCents: 4500 },
      { label: "Concert only (Sabbath afternoon)", amountCents: 1500 },
    ],
  },
  {
    slug: "2026-pastors-partners-retreat",
    title: "2026 Pastors' & Partners' Retreat",
    category: "Ministerial Dept",
    location: "Kiama, NSW",
    heroImageUrl: "/demo-banners/pastors-retreat.svg",
    description:
      "Four days of rest, worship and continuing education for ministers and their partners.\n\n" +
      "Sessions run each morning, with afternoons free. Childcare is available on request.",
    startsAt: at(105),
    endsAt: at(108),
    closesAt: at(72),
    capacity: 60,
    fullMessage: "Registrations for the retreat have closed. Please contact the Ministerial Department.",
    ownerEmail: "ministerial@example.org",
    tiers: [
      { label: "Minister", amountCents: 18000 },
      { label: "Minister and partner", amountCents: 30000 },
      { label: "Day attendance (per day)", amountCents: 6500 },
    ],
  },
  {
    slug: "2026-snsw-sports-fest",
    title: "2026 SNSW Sports Fest",
    category: "Youth",
    location: "Canberra, ACT",
    heroImageUrl: "/demo-banners/sports-fest.svg",
    description:
      "One day, four sports, every church welcome.\n\n" +
      "Teams of six to ten play a round-robin across basketball, volleyball, soccer and athletics. " +
      "Register as an individual and we will place you in a team, or bring your own.\n\n" +
      "Spectators are welcome and register free — this helps us cater lunch.",
    startsAt: at(89),
    endsAt: at(89),
    closesAt: at(82),
    capacity: 200,
    fullMessage: "Sports Fest has reached capacity. Spectators may still attend on the day.",
    ownerEmail: "youth@example.org",
    tiers: [
      { label: "Player", amountCents: 2500 },
      { label: "Spectator (includes lunch)", amountCents: 0 },
    ],
  },
  {
    slug: "2026-camp-cookery-course",
    title: "2026 Camp Cookery Course",
    category: "Camp",
    location: "Stuarts Point, NSW",
    heroImageUrl: "/demo-banners/camp-cookery.svg",
    description:
      "Learn to plan, cost and cook for a camp of two hundred.\n\n" +
      "Run by the summer camp kitchen team, this hands-on course covers menu planning, food safety, " +
      "catering for allergies at scale, and running a kitchen roster. Completing it qualifies you to " +
      "lead a camp kitchen.\n\n" +
      "Places are limited to twenty-four so that everyone gets bench time.",
    startsAt: at(39),
    endsAt: at(41),
    closesAt: at(32),
    capacity: 24,
    fullMessage: "The cookery course is full. It runs again in autumn — contact camp ministries to be notified.",
    ownerEmail: "youth@example.org",
    tiers: [
      { label: "Participant", amountCents: 6000 },
    ],
  },
];

const NEW_ORGANISERS = [
  { name: "Music Director", email: "music@example.org", password: "organiser12345" },
  { name: "Ministerial Secretary", email: "ministerial@example.org", password: "organiser12345" },
];

async function ensureOrganiser(
  person: { name: string; email: string; password: string },
  orgId: number
) {
  let record = await db.query.user.findFirst({ where: eq(authSchema.user.email, person.email) });
  if (!record) {
    await auth.api.signUpEmail({
      body: { name: person.name, email: person.email, password: person.password },
    });
    record = await db.query.user.findFirst({ where: eq(authSchema.user.email, person.email) });
    if (!record) throw new Error(`Failed to create ${person.email}`);
    console.log(`Created organiser: ${person.email} / ${person.password}`);
  }
  await db
    .update(authSchema.user)
    .set({ role: "organiser", orgId, active: true, emailVerified: true })
    .where(eq(authSchema.user.id, record.id));
  return record.id;
}

async function main() {
  const org = await db.query.orgs.findFirst();
  if (!org) throw new Error("No org found — run `npm run db:seed` first.");

  for (const person of NEW_ORGANISERS) await ensureOrganiser(person, org.id);

  for (const spec of EVENTS) {
    const existing = await db.query.events.findFirst({
      where: eq(schema.events.slug, spec.slug),
    });
    if (existing) {
      console.log(`Skipped (already exists): ${spec.slug}`);
      continue;
    }

    const owner = await db.query.user.findFirst({
      where: eq(authSchema.user.email, spec.ownerEmail),
    });
    if (!owner) throw new Error(`No owner ${spec.ownerEmail} — run db:seed-users first.`);

    const [event] = await db
      .insert(schema.events)
      .values({
        orgId: org.id,
        ownerId: owner.id,
        slug: spec.slug,
        title: spec.title,
        category: spec.category,
        heroImageUrl: spec.heroImageUrl,
        description: spec.description,
        location: spec.location,
        startsAt: spec.startsAt,
        endsAt: spec.endsAt,
        opensAt: new Date(Date.now() - DAY),
        closesAt: spec.closesAt,
        capacity: spec.capacity,
        fullMessage: spec.fullMessage,
        requiresPayment: true,
        status: "published",
      })
      .returning();

    await db.insert(schema.priceTiers).values(
      spec.tiers.map((t, i) => ({
        eventId: event.id,
        label: t.label,
        amountCents: t.amountCents,
        position: i,
      }))
    );

    console.log(
      `Created ${spec.title} — ${spec.tiers.length} options, owner ${spec.ownerEmail}`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
