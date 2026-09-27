import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: [resolve(apiDirectory, '.env.local'), resolve(apiDirectory, '.env')], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const target = new URL(databaseUrl);
if (
  !['postgres:', 'postgresql:'].includes(target.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  target.pathname !== '/basecamp'
) {
  throw new Error('db:nuke only accepts the local basecamp PostgreSQL database');
}

const maintenanceUrl = new URL(target);
maintenanceUrl.pathname = '/postgres';
const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
try {
  await client.connect();
  await client.query('DROP DATABASE IF EXISTS "basecamp" WITH (FORCE)');
  await client.query('CREATE DATABASE "basecamp"');
} finally {
  await client.end();
}

const migration = spawnSync('pnpm', ['--filter', 'api', 'db:migrate'], {
  cwd: apiDirectory,
  stdio: 'inherit',
});
if (migration.error) throw migration.error;
process.exit(migration.status ?? 1);
