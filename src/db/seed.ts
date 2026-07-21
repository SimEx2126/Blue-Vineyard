import "./load-env";
import { db, schema } from "./index";
import { generateReference } from "../lib/reference";

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const now = new Date();

  // Wipe (dev seed is idempotent-by-reset)
  await db.delete(schema.payments);
  await db.delete(schema.registrations);
  await db.delete(schema.priceTiers);
  await db.delete(schema.eventSections);
  await db.delete(schema.events);
  await db.delete(schema.orgs);

  const [org] = await db
    .insert(schema.orgs)
    .values({ name: "SNSW Events", brandColor: "#0f766e" })
    .returning();

  // ---- Main demo event (modelled on the Women's Retreat pattern) ----
  const [retreat] = await db
    .insert(schema.events)
    .values({
      orgId: org.id,
      slug: "2026-womens-retreat-demo",
      title: "2026 Women's Retreat (Demo)",
      category: "Womens Ministries",
      description:
        "A weekend away to rest, connect and be encouraged.\n\n" +
        "Join us in Jindabyne for a retreat of worship, workshops and friendship. " +
        "All attendees must be 18 years or older (breastfeeding infants excepted).\n\n" +
        "If you are not able to register online, please contact the conference office for assistance.",
      location: "Jindabyne, NSW",
      startsAt: new Date(now.getTime() + 90 * DAY),
      endsAt: new Date(now.getTime() + 92 * DAY),
      opensAt: new Date(now.getTime() - 30 * DAY),
      closesAt: new Date(now.getTime() + 80 * DAY),
      capacity: 96,
      fullMessage: "Registrations for this retreat have reached capacity.",
      status: "published",
    })
    .returning();

  let pos = 0;
  const section = (
    kind: string,
    required: boolean,
    config: unknown
  ): typeof schema.eventSections.$inferInsert => ({
    eventId: retreat.id,
    kind,
    position: pos++,
    required,
    config: config as Record<string, unknown>,
  });

  const inserted = await db
    .insert(schema.eventSections)
    .values([
      section("text_block", false, {
        title: "What to bring",
        body:
          "Jindabyne may be cold — come prepared: warm jacket, comfortable walking shoes, " +
          "sleeping bag or linen, towel and toiletries, casual clothes for wet or cold weather, and your Bible.",
      }),
      section("personal", true, { church: true }),
      section("address", true, {}),
      section("medical", true, { medicare: true }),
      section("emergency", true, {}),
      section("consent", true, {
        title: "Authorisation for emergency medical care",
        body:
          "In the event of accident or illness, I authorise the Event Director to consent on my behalf, " +
          "where it is impractical to communicate with me, to any medical or hospital treatment deemed " +
          "necessary by a licensed physician. I agree to pay the appropriate fees for such treatment and " +
          "any emergency transportation. I understand the risks associated with participation in this " +
          "event and agree to attend on this understanding.",
      }),
      section("dietary", false, {
        options: [
          "Anaphylactic (please provide details below)",
          "Gluten free",
          "Vegan",
          "Other (please provide details below)",
        ],
        detailsPrompt:
          "Please provide details if you are anaphylactic to anything or have other dietary requirements",
      }),
      section("choice", true, {
        label: "Please select one workshop",
        options: [
          { id: "start-strong", label: "Start Strong, Stay Strong — women's physical health", capacity: 40 },
          { id: "inner-glow", label: "Find Your Inner Glow — nutrition & skin health", capacity: 40 },
          { id: "paper-craft", label: "Paper Craft Workshop", capacity: 20 },
        ],
        multiple: false,
      }),
      section("media_consent", false, {
        options: ["Photo", "Video", "Livestreaming", "I would rather not"],
      }),
      section("custom_question", false, {
        label: "I would like to share a room with",
        type: "text",
        placeholder: "Name of preferred roommate",
      }),
      section("custom_question", false, {
        label: "Special needs or anything else you would like to tell us",
        type: "textarea",
      }),
    ])
    .returning();

  await db.insert(schema.priceTiers).values([
    { eventId: retreat.id, label: "Standard registration", amountCents: 25000, position: 0 },
    { eventId: retreat.id, label: "Day visitor — Saturday (includes meals)", amountCents: 4500, position: 1 },
  ]);

  // ---- Full event (capacity reached) ----
  const [summit] = await db
    .insert(schema.events)
    .values({
      orgId: org.id,
      slug: "2026-youth-summit-demo",
      title: "2026 Youth Summit (Demo — Full)",
      category: "Youth",
      description: "A leadership summit for young people across the conference.",
      location: "Canberra, ACT",
      startsAt: new Date(now.getTime() + 40 * DAY),
      endsAt: new Date(now.getTime() + 42 * DAY),
      opensAt: new Date(now.getTime() - 10 * DAY),
      closesAt: new Date(now.getTime() + 35 * DAY),
      capacity: 2,
      fullMessage: "The Youth Summit is sold out. Contact the youth department to join the waiting list.",
      status: "published",
    })
    .returning();

  const [summitPersonal] = await db
    .insert(schema.eventSections)
    .values([
      {
        eventId: summit.id,
        kind: "personal",
        position: 0,
        required: true,
        config: { church: false },
      },
    ])
    .returning();

  const [summitTier] = await db
    .insert(schema.priceTiers)
    .values([{ eventId: summit.id, label: "Registration", amountCents: 7500, position: 0 }])
    .returning();

  for (const [name, email] of [
    ["Demo Attendee One", "demo1@example.org"],
    ["Demo Attendee Two", "demo2@example.org"],
  ] as const) {
    const [reg] = await db
      .insert(schema.registrations)
      .values({
        orgId: org.id,
        eventId: summit.id,
        reference: generateReference(),
        status: "confirmed",
        contactName: name,
        contactEmail: email,
        answers: {
          [String(summitPersonal.id)]: {
            firstName: name.split(" ")[0],
            lastName: name.split(" ").slice(1).join(" "),
            email,
            phone: "0400 000 000",
          },
        },
        tierId: summitTier.id,
        pricing: {
          tier: { id: summitTier.id, label: summitTier.label, amountCents: summitTier.amountCents },
          totalCents: summitTier.amountCents,
        },
        amountCents: summitTier.amountCents,
      })
      .returning();
    await db.insert(schema.payments).values({
      orgId: org.id,
      registrationId: reg.id,
      kind: "charge",
      amountCents: summitTier.amountCents,
      status: "paid",
      gateway: "fake",
      gatewayRef: `fake_ch_seed_${reg.id}`,
    });
  }

  // ---- Not-yet-open event ----
  await db.insert(schema.events).values({
    orgId: org.id,
    slug: "2027-pathfinder-camporee-demo",
    title: "2027 Pathfinder Camporee (Demo — Opens Soon)",
    category: "Pathfinders",
    description: "The conference-wide Pathfinder camporee. Registrations open soon.",
    location: "Stuarts Point, NSW",
    startsAt: new Date(now.getTime() + 200 * DAY),
    endsAt: new Date(now.getTime() + 204 * DAY),
    opensAt: new Date(now.getTime() + 30 * DAY),
    capacity: 500,
    status: "published",
  });

  console.log(
    `Seeded org ${org.name}: retreat #${retreat.id} (${inserted.length} sections), summit #${summit.id} (full), camporee (opens soon).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
