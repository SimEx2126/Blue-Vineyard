import "./load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { db, schema } from "./index";

// A spread of events across many categories, each with a generated poster
// banner written to /public/banners. Run with: npx tsx src/db/seed-demo-events.ts

const ORG_ID = 1;

// Owner lookups by name, so events land on the themed organiser accounts.
const owners: Record<string, string> = {};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function wrap(text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A portrait poster: category-tinted gradient, decorative rings, the kicker,
// a wrapped title, and the date + place along the bottom.
function banner(opts: {
  title: string;
  category: string;
  from: string;
  to: string;
  dateLabel: string;
  location: string;
}) {
  const lines = wrap(opts.title.toUpperCase(), 14).slice(0, 3);
  const titleSize = lines.length >= 3 ? 96 : 110;
  const startY = 900 - (lines.length - 1) * (titleSize * 0.55);
  const titleSvg = lines
    .map(
      (l, i) =>
        `<text x="90" y="${startY + i * (titleSize + 8)}" font-size="${titleSize}" font-weight="800" fill="#ffffff" letter-spacing="-1">${esc(
          l
        )}</text>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${opts.from}"/>
      <stop offset="1" stop-color="${opts.to}"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="1250" fill="url(#g)"/>
  <circle cx="880" cy="140" r="260" fill="#ffffff" opacity="0.06"/>
  <circle cx="120" cy="1120" r="200" fill="#ffffff" opacity="0.05"/>
  <circle cx="880" cy="140" r="150" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.15"/>
  <!-- brand row -->
  <rect x="90" y="90" width="46" height="46" rx="12" fill="#ffffff" opacity="0.9"/>
  <rect x="101" y="104" width="24" height="20" rx="4" fill="none" stroke="${opts.to}" stroke-width="3"/>
  <line x1="101" y1="112" x2="125" y2="112" stroke="${opts.to}" stroke-width="3"/>
  <text x="152" y="122" font-size="22" font-weight="700" letter-spacing="4" fill="#ffffff">SOUTH NSW CONFERENCE</text>
  <!-- kicker -->
  <text x="90" y="720" font-size="30" font-weight="700" letter-spacing="6" fill="#ffffff" opacity="0.85">${esc(
    opts.category.toUpperCase()
  )}</text>
  <rect x="90" y="742" width="90" height="6" rx="3" fill="#ffffff" opacity="0.85"/>
  ${titleSvg}
  <!-- footer -->
  <line x1="90" y1="1120" x2="910" y2="1120" stroke="#ffffff" stroke-width="2" opacity="0.25"/>
  <text x="90" y="1170" font-size="30" font-weight="600" fill="#ffffff">${esc(opts.dateLabel)}</text>
  <text x="90" y="1210" font-size="26" fill="#ffffff" opacity="0.8">${esc(opts.location)}</text>
</svg>`;
}

type Seed = {
  title: string;
  category: string;
  owner?: string;
  location: string;
  description: string;
  starts: string;
  ends?: string;
  capacity?: number;
  from: string;
  to: string;
};

const SEEDS: Seed[] = [
  {
    title: "Women's Retreat 2026",
    category: "Women's Ministries",
    owner: "Women's Ministries Leader",
    location: "Koinonia Retreat, Bowral NSW",
    description:
      "A restful weekend away for women of all ages — worship, workshops and time to reconnect. Meals and accommodation provided.",
    starts: "2026-08-21",
    ends: "2026-08-23",
    capacity: 120,
    from: "#be123c",
    to: "#831843",
  },
  {
    title: "Youth Convention",
    category: "Youth",
    owner: "Youth Director",
    location: "Albury Entertainment Centre",
    description: "Three days of worship, seminars and connection for high-school and uni-age youth across the conference.",
    starts: "2026-09-18",
    ends: "2026-09-20",
    capacity: 300,
    from: "#6d28d9",
    to: "#4c1d95",
  },
  {
    title: "Praise & Worship Night",
    category: "Music",
    owner: "Music Director",
    location: "Wagga Wagga Church",
    description: "An evening of live worship and community singing. All welcome — bring a friend.",
    starts: "2026-08-08",
    from: "#4338ca",
    to: "#1e1b4b",
  },
  {
    title: "Kids Holiday Club",
    category: "Children's Ministry",
    location: "Griffith Community Hall",
    description: "A week of games, crafts, stories and songs for primary-age children during the spring holidays.",
    starts: "2026-09-28",
    ends: "2026-10-02",
    capacity: 80,
    from: "#d97706",
    to: "#92400e",
  },
  {
    title: "Health & Wellness Expo",
    category: "Health",
    location: "Tumut Civic Centre",
    description: "Free health checks, cooking demonstrations and talks on living well. Drop in any time.",
    starts: "2026-10-10",
    from: "#059669",
    to: "#064e3b",
  },
  {
    title: "Community Outreach Day",
    category: "Community Service",
    owner: "Ministerial Secretary",
    location: "Wagga Wagga CBD",
    description: "Join us serving the local community — food hampers, free BBQ and a helping hand where it's needed.",
    starts: "2026-08-30",
    from: "#0d9488",
    to: "#134e4a",
  },
  {
    title: "Family Camp Weekend",
    category: "Family",
    location: "Borambola Sport & Rec, NSW",
    description: "A weekend of camping, campfires and worship for the whole family. Cabins and camp sites available.",
    starts: "2026-11-06",
    ends: "2026-11-08",
    capacity: 200,
    from: "#0284c7",
    to: "#075985",
  },
  {
    title: "Bible Study Seminar",
    category: "Education",
    owner: "Ministerial Secretary",
    location: "Online & Wagga Wagga Church",
    description: "A four-part seminar on studying Scripture in context. Attend in person or join online.",
    starts: "2026-09-05",
    from: "#475569",
    to: "#1e293b",
  },
];

function fmt(d: Date) {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

async function main() {
  // Resolve owner ids by name.
  const users = await db.query.user.findMany();
  for (const u of users) owners[u.name] = u.id;

  mkdirSync("public/banners", { recursive: true });

  for (const s of SEEDS) {
    const slug = slugify(s.title);
    const starts = new Date(`${s.starts}T09:00:00+10:00`);
    const ends = s.ends ? new Date(`${s.ends}T17:00:00+10:00`) : null;
    const dateLabel = ends ? `${fmt(starts)} – ${fmt(ends)}` : fmt(starts);

    writeFileSync(
      `public/banners/${slug}.svg`,
      banner({
        title: s.title,
        category: s.category,
        from: s.from,
        to: s.to,
        dateLabel,
        location: s.location,
      })
    );

    await db.insert(schema.events).values({
      orgId: ORG_ID,
      ownerId: (s.owner && owners[s.owner]) || owners["Conference Office"] || null,
      slug,
      kind: "event",
      title: s.title,
      category: s.category,
      heroImageUrl: `/banners/${slug}.svg`,
      description: s.description,
      location: s.location,
      startsAt: starts,
      endsAt: ends,
      opensAt: new Date(),
      closesAt: ends ?? starts,
      capacity: s.capacity ?? null,
      requiresPayment: false,
      status: "published",
    });

    console.log(`created: ${s.title}  [${s.category}]  → /banners/${slug}.svg`);
  }

  console.log(`\nDone — ${SEEDS.length} events across ${new Set(SEEDS.map((s) => s.category)).size} categories.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
