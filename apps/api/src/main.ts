import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AUTH } from './auth/auth.module.js';
import { configureHttp } from './configure-http.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureHttp(app, app.get(AUTH));
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).get<number>('PORT', 8000));
}
bootstrap();
