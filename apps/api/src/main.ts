import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module.js';
import { auth } from './auth.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const server = app.getHttpAdapter().getInstance();

  // Better Auth needs the untouched request stream, so its catch-all handler
  // must be registered before Nest's body parsers.
  server.all('/api/auth/*splat', toNodeHandler(auth));

  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
