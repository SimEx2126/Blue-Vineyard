// One-off: give existing registrations a ticket reference.
// Safe to re-run — only fills rows that have none.
import "./load-env";
import { isNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db, schema } from "./index";
import { generateReference } from "../lib/reference";

async function main() {
  const rows = await db
    .select({ id: schema.registrations.id })
    .from(schema.registrations)
    .where(isNull(schema.registrations.reference));

  const used = new Set(
    (
      await db
        .select({ reference: schema.registrations.reference })
        .from(schema.registrations)
    )
      .map((r) => r.reference)
      .filter((r): r is string => !!r)
  );

  for (const row of rows) {
    let reference = generateReference();
    while (used.has(reference)) reference = generateReference();
    used.add(reference);
    await db
      .update(schema.registrations)
      .set({ reference })
      .where(eq(schema.registrations.id, row.id));
  }

  console.log(`Backfilled ${rows.length} registration(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
