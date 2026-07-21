// Adds a spread of church events across different ministries, each with its
// own mix of form sections — a chorister needs a voice part, a cook needs no
// medical form, a sports player needs a waiver. Idempotent: an event whose slug
// already exists is left alone.
import "./load-env";
import { eq } from "drizzle-orm";
import { db, schema, authSchema } from "./index";
import { auth } from "../lib/auth";

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY);

type Section = { kind: string; required: boolean; config: Record<string, unknown> };
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
  sections: Section[];
  tiers: Tier[];
  addOns?: { label: string; amountCents: number }[];
};

const PERSONAL: Section = { kind: "personal", required: true, config: { church: true } };
const CONSENT = (body: string): Section => ({
  kind: "consent",
  required: true,
  config: { title: "Agreement", body },
});
const DIETARY: Section = {
  kind: "dietary",
  required: false,
  config: {
    options: ["Anaphylactic (please provide details below)", "Gluten free", "Vegan", "Other"],
    detailsPrompt: "Please give details of any allergy or other dietary requirement",
  },
};
const MEDIA: Section = {
  kind: "media_consent",
  required: false,
  config: { options: ["Photo", "Video", "Livestreaming", "I would rather not"] },
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
    sections: [
      {
        kind: "text_block",
        required: false,
        config: {
          title: "Before you register",
          body: "Rehearsals run Friday 4pm and Sabbath 9am. Please bring a black folder and a music stand if you have one.",
        },
      },
      PERSONAL,
      {
        kind: "choice",
        required: true,
        config: {
          label: "Which part do you sing?",
          options: [
            { id: "soprano", label: "Soprano", capacity: 40 },
            { id: "alto", label: "Alto", capacity: 40 },
            { id: "tenor", label: "Tenor", capacity: 20 },
            { id: "bass", label: "Bass", capacity: 20 },
          ],
          multiple: false,
        },
      },
      {
        kind: "custom_question",
        required: false,
        config: { label: "Which choir or church do you sing with?", type: "text" },
      },
      {
        kind: "custom_question",
        required: false,
        config: { label: "I can help with setting up or packing down", type: "checkbox" },
      },
      DIETARY,
      MEDIA,
    ],
    tiers: [
      { label: "Singer", amountCents: 4500 },
      { label: "Concert only (Sabbath afternoon)", amountCents: 1500 },
    ],
    addOns: [{ label: "Printed music pack", amountCents: 1200 }],
  },
  {
    slug: "2026-pastors-partners-retreat",
    title: "2026 Pastors' & Partners' Retreat",
    category: "Ministerial Dept",
    location: "Kiama, NSW",
    heroImageUrl: "/demo-banners/pastors-retreat.svg",
    description:
      "Four days of rest, worship and continuing education for ministers and their partners.\n\n" +
      "Sessions run each morning, with afternoons free. Childcare is available on request — " +
      "please note the ages of any children in the box at the end of the form.",
    startsAt: at(105),
    endsAt: at(108),
    closesAt: at(72),
    capacity: 60,
    fullMessage: "Registrations for the retreat have closed. Please contact the Ministerial Department.",
    ownerEmail: "ministerial@example.org",
    sections: [
      PERSONAL,
      { kind: "address", required: true, config: {} },
      {
        kind: "choice",
        required: true,
        config: {
          label: "Accommodation",
          options: [
            { id: "single", label: "Single room", capacity: 20 },
            { id: "twin", label: "Twin share", capacity: 30 },
            { id: "own", label: "I will arrange my own", capacity: null },
          ],
          multiple: false,
        },
      },
      {
        kind: "custom_question",
        required: false,
        config: { label: "Name of partner attending with you", type: "text" },
      },
      {
        kind: "custom_question",
        required: false,
        config: {
          label: "Childcare required — please list ages",
          type: "textarea",
          placeholder: "e.g. 3 and 7",
        },
      },
      DIETARY,
    ],
    tiers: [
      { label: "Minister", amountCents: 18000 },
      { label: "Minister and partner", amountCents: 30000 },
      { label: "Day attendance (per day)", amountCents: 6500 },
    ],
    addOns: [{ label: "Airport transfer from Sydney", amountCents: 4500 }],
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
    sections: [
      PERSONAL,
      {
        kind: "choice",
        required: true,
        config: {
          label: "Which sports will you play?",
          options: [
            { id: "basketball", label: "Basketball", capacity: 60 },
            { id: "volleyball", label: "Volleyball", capacity: 60 },
            { id: "soccer", label: "Soccer", capacity: 60 },
            { id: "athletics", label: "Athletics", capacity: 40 },
          ],
          multiple: true,
        },
      },
      {
        kind: "custom_question",
        required: false,
        config: { label: "Team name, if you are entering as a team", type: "text" },
      },
      { kind: "emergency", required: true, config: {} },
      { kind: "medical", required: false, config: { medicare: true } },
      CONSENT(
        "I understand that participation in sport carries a risk of injury. I confirm that I am " +
          "fit to take part, and I agree to follow the directions of the umpires and organisers. " +
          "In the event of injury I authorise the organisers to obtain medical treatment on my behalf " +
          "where it is impractical to contact me or my emergency contact first."
      ),
      MEDIA,
    ],
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
    sections: [
      PERSONAL,
      {
        kind: "choice",
        required: true,
        config: {
          label: "Which stream suits you?",
          options: [
            { id: "beginner", label: "Beginner — never cooked at scale", capacity: 12 },
            { id: "experienced", label: "Experienced — I have helped in a camp kitchen", capacity: 12 },
          ],
          multiple: false,
        },
      },
      {
        kind: "custom_question",
        required: false,
        config: { label: "Do you hold a current food handling certificate?", type: "checkbox" },
      },
      {
        kind: "custom_question",
        required: false,
        config: {
          label: "Anything you particularly want covered?",
          type: "textarea",
        },
      },
      DIETARY,
      CONSENT(
        "I agree to follow all kitchen safety directions, to wear closed-in shoes in the kitchen, " +
          "and to disclose any condition that may affect my safe participation."
      ),
    ],
    tiers: [
      { label: "Participant", amountCents: 6000 },
    ],
    addOns: [{ label: "Recipe folder and apron", amountCents: 2500 }],
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
        status: "published",
      })
      .returning();

    await db.insert(schema.eventSections).values(
      spec.sections.map((s, i) => ({
        eventId: event.id,
        kind: s.kind,
        position: i,
        required: s.required,
        config: s.config,
      }))
    );

    await db.insert(schema.priceTiers).values(
      spec.tiers.map((t, i) => ({
        eventId: event.id,
        label: t.label,
        amountCents: t.amountCents,
        position: i,
      }))
    );

    if (spec.addOns?.length) {
      await db.insert(schema.addOns).values(
        spec.addOns.map((a, i) => ({
          eventId: event.id,
          label: a.label,
          amountCents: a.amountCents,
          position: i,
        }))
      );
    }

    console.log(
      `Created ${spec.title} — ${spec.sections.length} sections, ${spec.tiers.length} options, owner ${spec.ownerEmail}`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
