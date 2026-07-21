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
  await db.delete(schema.events);
  await db.delete(schema.orgs);

  const [org] = await db
    .insert(schema.orgs)
    .values({ name: "SNSW Events", brandColor: "#0f766e" })
    .returning();

  // ---- Main demo event ----
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
      requiresPayment: true,
      status: "published",
    })
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
      requiresPayment: true,
      status: "published",
    })
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
    `Seeded org ${org.name}: retreat #${retreat.id}, summit #${summit.id} (full), camporee (opens soon).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
