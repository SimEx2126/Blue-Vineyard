import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Better Auth's tables are registered alongside ours so that db.query.user
// works and the Drizzle adapter can find them.
export const db = drizzle(pool, { schema: { ...schema, ...authSchema } });
export { schema, authSchema };
