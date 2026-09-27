import { Body, Controller, HttpCode, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Auth } from '../src/auth.js';
import { configureHttp } from '../src/configure-http.js';

let observedBody: unknown;

@Controller()
class EchoController {
  @Post('echo')
  @HttpCode(200)
  echo(@Body() body: unknown) {
    return body;
  }
}

@Module({ controllers: [EchoController] })
class HttpTestModule {}

describe('configureHttp', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    observedBody = undefined;
    const handler: Auth['handler'] = async (incomingRequest) => {
      observedBody = await incomingRequest.json();
      const headers = new Headers({ 'content-type': 'application/json' });
      headers.append('set-cookie', 'session=one; Path=/; HttpOnly');
      headers.append('set-cookie', 'session_meta=two; Path=/; HttpOnly');
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    };

    app = await NestFactory.create<NestExpressApplication>(HttpTestModule, {
      bodyParser: false,
    });
    configureHttp(app, { handler } as Auth);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('keeps raw auth bodies and every response cookie while parsing normal JSON routes', async () => {
    const authResponse = await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'discord' })
      .expect(200);

    expect(observedBody).toEqual({ provider: 'discord' });
    expect(authResponse.headers['set-cookie']).toHaveLength(2);

    await request(app.getHttpServer()).post('/echo').send({ value: 42 }).expect(200, { value: 42 });
  });
});
