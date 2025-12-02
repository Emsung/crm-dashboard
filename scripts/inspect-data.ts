import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../lib/db';
import { trialBookings } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

import { sql } from 'drizzle-orm';

async function main() {
    const tables = await db.execute(sql`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
  `);

    console.log('Tables:', tables.rows);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
