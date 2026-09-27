import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

export const apiEnvFiles = [
  // Source execution (Vitest / watch mode).
  fileURLToPath(new URL('../.env.local', import.meta.url)),
  fileURLToPath(new URL('../.env', import.meta.url)),
  // Compiled execution from dist/src.
  fileURLToPath(new URL('../../.env.local', import.meta.url)),
  fileURLToPath(new URL('../../.env', import.meta.url)),
];

config({ path: apiEnvFiles, quiet: true });
