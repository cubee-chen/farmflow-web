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

// Singleton pattern: Next.js HMR re-evaluates modules on every hot reload,
// which would create a new postgres.js client (and a new connection pool) each
// time — quickly exhausting Supabase's session-mode limit of 15 connections.
// Storing the client on globalThis survives HMR and keeps exactly one pool.
const g = globalThis as typeof globalThis & { _pgClient?: ReturnType<typeof postgres> };

const client =
  g._pgClient ??
  postgres(process.env.DATABASE_URL!, {
    ssl: 'require',
    max: 5,           // leave headroom for Drizzle Studio, admin scripts, etc.
    idle_timeout: 20, // release idle connections after 20 s
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') g._pgClient = client;

export const db = drizzle(client);
export const sql = client;
