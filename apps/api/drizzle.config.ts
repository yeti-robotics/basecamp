import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const apiDirectory = dirname(fileURLToPath(import.meta.url));
const fromApi = (path: string) => relative(process.cwd(), resolve(apiDirectory, path));

config({ path: [fromApi('./.env.local'), fromApi('./.env')], quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in the environment variables.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: fromApi('./src/database/schema/index.ts'),
  out: fromApi('./drizzle'),
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
