import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';

// Runtime handle (Neon HTTP). Not used in tests.
const connectionString = process.env.DATABASE_URL;
export const db = connectionString
  ? drizzle(neon(connectionString), { schema })
  : (undefined as unknown as NeonHttpDatabase<typeof schema>);

// The union both drivers satisfy — every repository takes this as its first arg.
export type DB = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;
