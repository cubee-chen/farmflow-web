import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dns from 'dns';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dns.setDefaultResultOrder('ipv4first');

// Scripts (tsx) don't get Next.js env loading — read .env.local manually
if (!process.env.DATABASE_URL) {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^=#\s][^=]*)=(.*)/);
      if (m) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}

const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

export const db = drizzle(client);
export const sql = client;
