import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

export const db = drizzle(client);
export const sql = client;
