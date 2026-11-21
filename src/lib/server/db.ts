import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function connect() {
  if (!env.DATABASE_URL) throw new Error('Configure DATABASE_URL.');
  return drizzle(postgres(env.DATABASE_URL), { schema });
}

let db: ReturnType<typeof connect> | undefined;

export function getDb() {
  return db ??= connect();
}
