import type { ConfigModuleOptions } from '@nestjs/config';
import { apiEnvFiles } from './env.js';
import { envSchema } from './env.validation.js';

export const configOptions = {
  isGlobal: true,
  envFilePath: apiEnvFiles,
  validationSchema: envSchema,
} satisfies ConfigModuleOptions;
