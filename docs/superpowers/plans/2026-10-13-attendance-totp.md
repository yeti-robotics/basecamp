# Attendance TOTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require the facility display's rotating four-digit code for member `/signin` and `/signout` while preserving the existing attendance writes.

**Architecture:** NestJS owns the TOTP seed, display password, session, verification, and rate limits. A protected API endpoint gives the authenticated dashboard display the seed once; the browser generates subsequent codes locally. The existing attendance service remains responsible for recording rows, with new self-service entry points that verify the code before calling it.

**Tech Stack:** NestJS 12, Necord 7, `@nestjs/throttler` with its default in-memory storage, Next.js 16, Web Crypto, Vitest, Jest, pnpm.

**Spec:** [`docs/attendance-totp-spec.md`](../../attendance-totp-spec.md)

## Global Constraints

- RFC 6238 TOTP, HMAC-SHA-1, 30-second steps, four decimal digits with leading zeroes.
- Seed is at least 20 random bytes encoded as Base32; accept current, preceding, and following server time steps.
- Password-protected display session lasts 12 hours; its cookie is signed, `HttpOnly`, and `Secure` in production.
- Use NestJS Throttler's in-memory storage. This deployment runs one API instance; no Redis or attempt table.
- Code and password values must not appear in logs, attendance rows, persistent browser storage, or cookies.
- Admin commands, event scheduling, and attendance-hour calculations are outside this plan.

## Review Focus

1. `0042` must survive Discord option parsing; Task 3 passes it through the command handler and checks the registered option in a development guild.
2. A malformed code must fail before any attendance write; Task 2 tests the self-service boundary, and Task 3 checks the pipe/filter response in a development guild.
3. The same code must work for two different members; Task 2 tests both calls while existing attendance rules reject a repeated transition for one member.
4. A tampered or expired display cookie must not disclose the seed; Task 4 exercises both through HTTP requests. A stolen valid cookie remains a credential until expiry.
5. A display left open after session expiry must stop generating codes; Task 5 tests rollover and expiry with fake timers.

---

## Test boundary

Tests should exercise the smallest public interface that proves a real user outcome. Keep one fixed-clock TOTP test, one self-service attendance suite, one member-command reply suite, one HTTP display-login suite, and one display UI suite. Do not add standalone DTO, exception-filter, guard, environment-parser, or session-helper tests unless a concrete behavior cannot be covered through those interfaces. Test assertions should concern accepted/rejected attendance transitions, ephemeral replies, seed access, throttling, rollover, and expiry. Avoid asserting decorator metadata or internal call counts except the no-write guarantee on rejected attendance. Verify Necord decorator/guard/pipe wiring in a development guild because calling a command method directly does not execute that framework pipeline.

## File map

| File | Responsibility |
| --- | --- |
| `packages/attendance-code/src/index.ts` | Isomorphic Base32 decoding and four-digit TOTP generation |
| `packages/attendance-code/src/index.spec.ts` | Fixed-clock RFC vector and zero-padding contract |
| `packages/attendance-code/package.json`, `tsconfig.json` | Buildable workspace package for API and dashboard |
| `turbo.json` | Build the shared package before dependent test tasks |
| `apps/api/src/env.validation.ts` | Fail-fast seed, password, and session-key validation |
| `apps/api/src/attendance/attendance-code.service.ts` | Server-side TOTP verification with timing-safe comparisons |
| `apps/api/src/attendance/attendance.service.ts` | Code-protected self-service methods using existing persistence |
| `apps/api/src/attendance/attendance.commands.ts` | String code options and ephemeral member responses |
| `apps/api/src/attendance/attendance-options.dto.ts` | Necord option shape and four-digit validation |
| `apps/api/src/attendance/attendance-interaction.filter.ts` | Ephemeral replies for pipe and throttle errors |
| `apps/api/src/attendance/attendance-throttler.guard.ts` | Adapt Nest Throttler to a Discord user ID |
| `apps/api/src/attendance/display-session.service.ts` | Password verification and 12-hour signed cookie |
| `apps/api/src/attendance/display.controller.ts` | Throttled login, authenticated seed response, logout |
| `apps/api/src/attendance/attendance.module.ts` | Feature providers, controllers, and Throttler registration |
| `apps/dashboard/app/attendance/display/page.tsx` | Display login and protected code screen |
| `apps/dashboard/app/attendance/display/CodeDisplay.tsx` | Browser-side rollover and session expiry |
| `apps/dashboard/next.config.js` | Same-origin API rewrite and no-store display headers |
| `apps/dashboard/jest.config.cjs`, `jest.setup.ts` | Discover dashboard app tests and enable DOM matchers |

### Task 1: Shared TOTP primitive

**Files:**
- Create: `packages/attendance-code/package.json`
- Create: `packages/attendance-code/tsconfig.json`
- Create: `packages/attendance-code/src/index.ts`
- Create: `packages/attendance-code/src/index.spec.ts`
- Modify: `apps/api/package.json`, `apps/dashboard/package.json`, `pnpm-lock.yaml`
- Modify: `turbo.json`

**Interfaces:**
- Consumes: browser/Node `globalThis.crypto.subtle`.
- Produces: `decodeSeed(base32: string): Uint8Array` and `generateAttendanceCode(base32: string, timestampMs?: number): Promise<string>`.

- [ ] **Step 1: Write the failing package tests.**

~~~ts
import { describe, expect, it } from 'vitest';
import { generateAttendanceCode } from './index.js';

const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
describe('attendance TOTP', () => {
  it('matches the RFC SHA-1 vector truncated to four digits', async () => {
    expect(await generateAttendanceCode(seed, 59_000)).toBe('7082');
  });
  it('preserves leading zeroes', async () => {
    expect(await generateAttendanceCode(seed, 270_000)).toBe('0489');
  });
});
~~~

- [ ] **Step 2: Run the red test.** Run `pnpm install`, then `pnpm --filter @repo/attendance-code test` after creating the package manifest with `"test": "vitest run"`. Expected: missing exports or assertion failure.
- [ ] **Step 3: Implement and build the package.** Add the manifest and TypeScript config below, and add `"@repo/attendance-code": "workspace:*"` to both app dependency lists.

~~~json
{
  "name": "@repo/attendance-code",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "check-types": "tsc --noEmit",
    "lint": "biome check ."
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
}
~~~

~~~json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/index.ts"],
  "exclude": ["src/index.spec.ts"]
}
~~~

~~~ts
export function decodeSeed(base32: string): Uint8Array {
  const normalized = base32.toUpperCase().replace(/=+$/, '');
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error('Invalid Base32 seed');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of normalized) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 255);
    }
  }
  if (bytes.length < 20) throw new Error('TOTP seed must contain at least 20 bytes');
  return Uint8Array.from(bytes);
}

export async function generateAttendanceCode(
  base32: string,
  timestampMs = Date.now(),
): Promise<string> {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error('Invalid time');
  const key = await crypto.subtle.importKey(
    'raw', decodeSeed(base32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(Math.floor(timestampMs / 30_000)));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = hash[hash.length - 1] & 15;
  const value = (
    ((hash[offset] & 127) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3]
  ) % 10_000;
  return String(value).padStart(4, '0');
}
~~~

- [ ] **Step 4: Run green checks.** Change `turbo.json`'s test task to `"dependsOn": ["^build", "^test"]`, then run `pnpm install`, `pnpm --filter @repo/attendance-code test`, and `pnpm --filter @repo/attendance-code build`. Expected: all pass and the package exports resolve from each app.
- [ ] **Step 5: Commit.** Run `git add packages/attendance-code apps/api/package.json apps/dashboard/package.json pnpm-lock.yaml turbo.json` and `git commit -m "feat(attendance): add shared four-digit TOTP primitive"`.

### Task 2: Server verification and protected attendance boundary

**Files:**
- Modify: `apps/api/src/env.validation.ts`, `apps/api/.env.example`
- Modify: `apps/api/src/attendance/attendance.module.ts`
- Create: `apps/api/src/attendance/attendance-code.service.ts`, `apps/api/src/attendance/attendance-code.service.spec.ts`
- Modify: `apps/api/src/attendance/attendance.service.ts`, `apps/api/src/attendance/attendance.service.spec.ts`
- Modify: any existing API test fixture that constructs `AppModule` or `AttendanceModule` and now needs the required env/provider.

**Interfaces:**
- Consumes: `generateAttendanceCode` and the existing `recordAttendance` / `updateAttendance` methods.
- Produces: `AttendanceCodeService.verify(code: string, nowMs?: number): Promise<boolean>`, `AttendanceService.signInWithCode(discordId: string, code: string): ResultAsync<void, Error>`, and `signOutWithCode(discordId: string, code: string): ResultAsync<void, Error>`.

- [ ] **Step 1: Write a red test against the verifier's public method.** Use a fixed seed and clock to pin the accepted window and a leading-zero code; the self-service test below covers the no-write path.

~~~ts
expect(await codeService.verify('0489', 270_000)).toBe(true);
expect(await codeService.verify('0489', 300_000)).toBe(true);
expect(await codeService.verify('0489', 330_000)).toBe(false);
~~~

- [ ] **Step 2: Run the red test.** Run `pnpm --filter api test -- src/attendance/attendance-code.service.spec.ts`. Expected: missing verifier.
- [ ] **Step 3: Implement validation and verifier.** Add required `ATTENDANCE_TOTP_SECRET` to the Zod schema, using `decodeSeed` in a refinement; add the documented env example. Register the service in `AttendanceModule`.

~~~ts
ATTENDANCE_TOTP_SECRET: z.string().refine((value) => {
  try { decodeSeed(value); return true; }
  catch { return false; }
}, 'ATTENDANCE_TOTP_SECRET must be a Base32 seed of at least 20 bytes'),
~~~

~~~ts
@Injectable()
export class AttendanceCodeService {
  private readonly seed: string;
  constructor(config: ConfigService) {
    this.seed = config.getOrThrow<string>('ATTENDANCE_TOTP_SECRET');
    decodeSeed(this.seed);
  }
  async verify(code: string, nowMs = Date.now()): Promise<boolean> {
    if (!/^[0-9]{4}$/.test(code)) return false;
    let valid = false;
    for (const shift of [-30_000, 0, 30_000]) {
      const candidate = await generateAttendanceCode(this.seed, nowMs + shift);
      valid = timingSafeEqual(Buffer.from(code), Buffer.from(candidate)) || valid;
    }
    return valid;
  }
}
~~~

- [ ] **Step 4: Write a red self-service test through the new public methods.** Reuse the existing repository fake in `attendance.service.spec.ts` and inject a verifier fake that accepts only `'0042'`. With a wrong or malformed code, assert no record is written or updated. With the valid display code, assert two Discord IDs can each sign in once, while a second sign-in for either ID fails under the existing attendance rule. Include a sign-out call through `signOutWithCode` so both member transitions are covered.

~~~ts
codeService.verify.mockImplementation(async (code: string) => code === '0042');
expect((await service.signInWithCode(DISCORD_ID, '9999')).isErr()).toBe(true);
expect(mockRepository.createRecord).not.toHaveBeenCalled();
expect((await service.signOutWithCode(DISCORD_ID, '42')).isErr()).toBe(true);
expect(mockRepository.updateLast).not.toHaveBeenCalled();
expect((await service.signInWithCode(DISCORD_ID, '0042')).isOk()).toBe(true);
expect((await service.signInWithCode(SECOND_DISCORD_ID, '0042')).isOk()).toBe(true);
~~~

- [ ] **Step 5: Add self-service entry points.** Keep the existing write methods for internal attendance behavior; route member commands only through these two wrappers. Use `ResultAsync.fromPromise` to bridge the verifier Promise into the existing `neverthrow` flow.

~~~ts
signInWithCode(discordId: string, code: string): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(this.codeService.verify(code), (e) => new Error(String(e)))
    .andThen((valid) => valid
      ? this.recordAttendance(discordId, 'meeting', null)
      : errAsync(new Error('Invalid attendance code')));
}
signOutWithCode(discordId: string, code: string): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(this.codeService.verify(code), (e) => new Error(String(e)))
    .andThen((valid) => valid
      ? this.updateAttendance(discordId, { checkedOutAt: new Date() })
      : errAsync(new Error('Invalid attendance code')));
}
~~~

- [ ] **Step 6: Run green checks.** Run `pnpm --filter api test` and `pnpm --filter api build`. Expected: pass; older service tests retain their behavior.
- [ ] **Step 7: Commit.** Run `git add apps/api/src/env.validation.ts apps/api/.env.example apps/api/src/attendance apps/api/src/app.module.spec.ts apps/api/test` and `git commit -m "feat(attendance): verify display codes before self check-in"`. Review staged files before committing so unrelated edits are excluded.

### Task 3: Discord options and Nest Throttler

**Files:**
- Modify: `apps/api/package.json`, `pnpm-lock.yaml`
- Modify: `apps/api/src/attendance/attendance.module.ts`, `apps/api/src/attendance/attendance.commands.ts`, `apps/api/src/attendance/attendance.commands.spec.ts`
- Create: `apps/api/src/attendance/attendance-options.dto.ts`
- Create: `apps/api/src/attendance/attendance-throttler.guard.ts`
- Create: `apps/api/src/attendance/attendance-interaction.filter.ts`

**Interfaces:**
- Consumes: `AttendanceService.signInWithCode` and `signOutWithCode`.
- Produces: `/signin code:<four characters>` and `/signout code:<four characters>` with ephemeral success/errors; a shared five-attempt-per-minute Discord actor limit across both commands.

- [ ] **Step 1: Write red member-command reply tests.** Extend the existing `attendance.commands.spec.ts` interaction helper with `deferReply` and `editReply`. Call the command methods with `'0042'` as a string and a mocked self-service result. Assert both commands forward the actor ID and exact code, return an ephemeral success, and give an ephemeral invalid-code error. The self-service suite already proves no-write and shared-code behavior; avoid repeating it here.

~~~ts
service.signInWithCode.mockReturnValue(okAsync(undefined));
await commands.SigninCommand([interaction] as never, { code: '0042' });
expect(service.signInWithCode).toHaveBeenCalledWith(interaction.user.id, '0042');
expect(interaction.deferReply).toHaveBeenCalledWith({ flags: [MessageFlags.Ephemeral] });
expect(interaction.editReply).toHaveBeenCalledWith('Signed in.');

service.signOutWithCode.mockReturnValue(errAsync(new Error('Invalid attendance code')));
await commands.SignoutCommand([interaction] as never, { code: '9999' });
expect(interaction.editReply).toHaveBeenCalledWith(
  'Invalid or expired code. Check the display and try again.',
);
~~~

- [ ] **Step 2: Run the red test.** Run `pnpm --filter api test -- src/attendance/attendance.commands.spec.ts`. Expected: commands accept no code and cannot satisfy the behavior above.
- [ ] **Step 3: Install and register Throttler.** Run `pnpm --filter api add @nestjs/throttler class-validator class-transformer`. Import `ThrottlerModule.forRoot([{ name: 'attendance', ttl: 60_000, limit: 5 }])` in `AttendanceModule` and register `AttendanceThrottlerGuard` and `AttendanceInteractionFilter` as providers. Do not register a global guard.
- [ ] **Step 4: Implement the DTO and Discord adapter.**

~~~ts
export class AttendanceCodeOptions {
  @IsString()
  @Matches(/^[0-9]{4}$/)
  @StringOption({ name: 'code', description: 'Four digits shown at the facility', required: true })
  code!: string;
}
~~~

The `AttendanceThrottlerGuard` extends `ThrottlerGuard` and overrides `handleRequest`. Obtain `interaction.user.id` with `NecordExecutionContext.create(context).getContext()[0]`, use one storage key (`'attendance-code:' + id`) for both handlers, and call Throttler storage. The `AttendanceInteractionFilter` uses `NecordArgumentsHost.create(host).getContext()[0]` and sends an ephemeral format or retry message for `BadRequestException` and `ThrottlerException`.

~~~ts
protected async handleRequest({ context, limit, ttl, throttler, blockDuration }: ThrottlerRequest) {
  const [interaction] = NecordExecutionContext.create(context).getContext();
  const key = 'attendance-code:' + interaction.user.id;
  const result = await this.storageService.increment(
    key, ttl, limit, blockDuration, throttler.name,
  );
  if (result.isBlocked) throw new ThrottlerException('Too many code attempts');
  return true;
}
~~~

~~~ts
@Catch(BadRequestException, ThrottlerException)
export class AttendanceInteractionFilter implements ExceptionFilter {
  catch(error: BadRequestException | ThrottlerException, host: ArgumentsHost) {
    const [interaction] = NecordArgumentsHost.create(host).getContext();
    const content = error instanceof ThrottlerException
      ? 'Too many attempts. Wait a minute and try again.'
      : 'Enter the four digits shown on the facility display.';
    if (interaction.deferred || interaction.replied) return interaction.editReply({ content });
    return interaction.reply({ content, flags: [MessageFlags.Ephemeral] });
  }
}
~~~

- [ ] **Step 5: Replace only the self-service command methods.** Use `@Options(new ValidationPipe({ validateCustomDecorators: true }))`, `@UseGuards(AttendanceThrottlerGuard)`, and `@UseFilters(AttendanceInteractionFilter)` on both methods. Defer ephemerally, call the protected service entry point, then edit the reply with a success or existing attendance error. Leave admin handlers and read-only commands untouched.

~~~ts
@UseGuards(AttendanceThrottlerGuard)
@UseFilters(AttendanceInteractionFilter)
@SlashCommand({ name: 'signin', description: 'Sign in to a YETI meeting at the zone' })
async SigninCommand(
  @Context() [interaction]: SlashCommandContext,
  @Options(new ValidationPipe({ validateCustomDecorators: true })) options: AttendanceCodeOptions,
) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  const result = await this.attendanceService.signInWithCode(interaction.user.id, options.code);
  return interaction.editReply(result.isOk() ? 'Signed in.' : formatAttendanceError(result.error));
}
~~~

Define `formatAttendanceError(error: Error): string` beside the commands; never echo the submitted code.

~~~ts
function formatAttendanceError(error: Error): string {
  switch (error.message) {
    case 'Invalid attendance code': return 'Invalid or expired code. Check the display and try again.';
    case 'User is already signed in': return "You're already signed in.";
    case 'User is already signed out': return "You're already signed out.";
    case 'User was not signed out because they have not signed in yet':
      return 'You need to sign in before signing out.';
    default: return 'Attendance could not be updated. Please try again or ask a mentor.';
  }
}
~~~

- [ ] **Step 6: Run green checks.** Run `pnpm --filter api test` and `pnpm --filter api build`. Expected: pass. In a development guild, check that the registered option is a string, `0042` reaches the command with its zeroes, a malformed value gets an ephemeral format error, the sixth attempt by one user gets an ephemeral retry message, and a different user can still submit a code.
- [ ] **Step 7: Commit.** Run `git add apps/api/src/attendance apps/api/package.json pnpm-lock.yaml` and `git commit -m "feat(attendance): require throttled Discord display codes"`.

### Task 4: Password-protected display API

**Files:**
- Modify: `apps/api/src/env.validation.ts`, `apps/api/.env.example`, `apps/api/src/attendance/attendance.module.ts`
- Create: `apps/api/src/attendance/display-session.service.ts`
- Create: `apps/api/src/attendance/display.controller.ts`, `apps/api/src/attendance/display.controller.spec.ts`
- Modify: API module/e2e config fixtures that now require the display env variables.

**Interfaces:**
- Consumes: API-owned TOTP seed and `ThrottlerModule` from Task 3.
- Produces: `POST /api/attendance-display/login` (`{password: string}`), `GET /api/attendance-display/seed` (`{secret: string, expiresAt: number}`), and `POST /api/attendance-display/logout`.

- [ ] **Step 1: Write red HTTP tests.** Use the Nest HTTP app and Supertest. Assert wrong password returns 401 and no seed, sixth login attempt from one address returns 429, successful login sets `HttpOnly`/`SameSite=Lax`/production `Secure` cookie, a tampered cookie returns 401, a valid cookie returns only `secret` and `expiresAt` with `Cache-Control: no-store`, expiry returns 401 under a fake clock, and logout clears the cookie. Keep this one suite as the display API contract; do not separately test signing helpers.

~~~ts
await request(app.getHttpServer()).post('/api/attendance-display/login')
  .send({ password: 'wrong' }).expect(401);
await request(app.getHttpServer()).get('/api/attendance-display/seed').expect(401);
const login = await request(app.getHttpServer())
  .post('/api/attendance-display/login')
  .send({ password: 'mentor-configured-password' }).expect(204);
const cookie = login.headers['set-cookie'][0];
expect(cookie).toContain('HttpOnly');
const seed = await request(app.getHttpServer())
  .get('/api/attendance-display/seed').set('Cookie', cookie).expect(200);
expect(seed.body).toEqual({ secret: TEST_SEED, expiresAt: expect.any(Number) });
expect(seed.headers['cache-control']).toBe('no-store');
await request(app.getHttpServer()).get('/api/attendance-display/seed')
  .set('Cookie', cookie.replace(/(attendance_display=[^.]+\.)[^;]+/, '$1tampered'))
  .expect(401);
~~~

- [ ] **Step 2: Run the red HTTP tests.** Run `pnpm --filter api test -- src/attendance/display.controller.spec.ts`. Expected: missing controller.
- [ ] **Step 3: Implement the session service and config.** Add required `ATTENDANCE_DISPLAY_PASSWORD` (nonblank) and `ATTENDANCE_DISPLAY_SESSION_SECRET` (at least 32 characters) to `envSchema` and fixture values. Compare password hashes with `timingSafeEqual`. A password change should be paired with session-secret rotation in deployment instructions.

~~~ts
ATTENDANCE_DISPLAY_PASSWORD: z.string().trim().min(1),
ATTENDANCE_DISPLAY_SESSION_SECRET: z.string().min(32),
~~~

~~~ts
private mac(expiry: number): Buffer {
  return createHmac('sha256', this.sessionSecret)
    .update('attendance-display:' + expiry)
    .digest();
}
create(nowMs = Date.now()): string {
  const expiry = nowMs + 43_200_000;
  return expiry + '.' + this.mac(expiry).toString('base64url');
}
verify(token: string, nowMs = Date.now()): number | null {
  const match = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) return null;
  const expiry = Number(match[1]);
  const received = Buffer.from(match[2], 'base64url');
  const expected = this.mac(expiry);
  if (!Number.isSafeInteger(expiry) || expiry <= nowMs ||
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)) return null;
  return expiry;
}
checkPassword(candidate: string): boolean {
  const supplied = createHash('sha256').update(candidate).digest();
  const expected = createHash('sha256').update(this.password).digest();
  return timingSafeEqual(supplied, expected);
}
~~~
- [ ] **Step 4: Implement the controller.** Apply `@UseGuards(ThrottlerGuard)` and `@Throttle({ attendance: { limit: 5, ttl: 900_000 } })` only to login, using the client IP supplied by the trusted HTTP proxy. Validate the password body as a concrete DTO with `ValidationPipe`. Set an `HttpOnly` signed cookie for 12 hours. The seed endpoint reads that cookie, verifies it, sets no-store headers, and returns only the seed and expiry. Never log the password, token, or seed.

~~~ts
class DisplayLoginDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}

@Controller('api/attendance-display')
export class DisplayController {
constructor(
  private readonly sessions: DisplaySessionService,
  private readonly config: ConfigService,
) {}

@Post('login')
@UseGuards(ThrottlerGuard)
@Throttle({ attendance: { limit: 5, ttl: 900_000 } })
login(@Body(new ValidationPipe()) body: DisplayLoginDto, @Res() response: Response) {
  if (!this.sessions.checkPassword(body.password)) throw new UnauthorizedException();
  response.cookie('attendance_display', this.sessions.create(), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 43_200_000, path: '/',
  });
  return response.status(204).send();
}

@Get('seed')
seed(@Req() request: Request, @Res() response: Response) {
  const token = readCookie(request.headers.cookie, 'attendance_display');
  const expiresAt = token && this.sessions.verify(token);
  if (!expiresAt) throw new UnauthorizedException();
  response.setHeader('Cache-Control', 'no-store');
  return response.json({
    secret: this.config.getOrThrow<string>('ATTENDANCE_TOTP_SECRET'),
    expiresAt,
  });
}

@Post('logout')
logout(@Res() response: Response) {
  response.clearCookie('attendance_display', { path: '/' });
  return response.status(204).send();
}
}
~~~

Define `readCookie(header: string | undefined, name: string): string | null` in `display-session.service.ts` as a strict cookie-name lookup; reject duplicate matching cookie names. Implement `POST logout` to clear `attendance_display` with the same path and cookie flags.

~~~ts
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const matches = header.split(';').map((part) => part.trim())
    .filter((part) => part.startsWith(name + '='));
  if (matches.length !== 1) return null;
  try { return decodeURIComponent(matches[0].slice(name.length + 1)); }
  catch { return null; }
}
~~~
- [ ] **Step 5: Run green checks.** Run `pnpm --filter api test`, `pnpm --filter api test:e2e`, and `pnpm --filter api build`. Expected: pass; verify login rate limiting in one API process.
- [ ] **Step 6: Commit.** Run `git add apps/api/src/attendance apps/api/src/env.validation.ts apps/api/.env.example apps/api/test apps/api/src/app.module.spec.ts` and `git commit -m "feat(attendance): protect display seed with a throttled login"`.

### Task 5: Facility display in the dashboard

**Files:**
- Modify: `apps/dashboard/next.config.js`, `apps/dashboard/jest.config.cjs`, `apps/dashboard/README.md`
- Create: `apps/dashboard/jest.setup.ts`
- Create: `apps/dashboard/app/attendance/display/page.tsx`
- Create: `apps/dashboard/app/attendance/display/CodeDisplay.tsx`
- Create: `apps/dashboard/app/attendance/display/CodeDisplay.test.tsx`
- Create: `apps/dashboard/app/attendance/display/page.test.tsx`

**Interfaces:**
- Consumes: Task 4's same-origin API endpoints and Task 1's `generateAttendanceCode`.
- Produces: a password form and `CodeDisplay({ secret, expiresAt, onExpired }: { secret: string; expiresAt: number; onExpired: () => void })`, a locally rotating, zero-padded four-digit display.

- [ ] **Step 1: Write red display tests.** Use the fixed test seed and real shared code generator with a fake clock. Through the rendered display, assert `0489` appears, rollover shows a different four-digit code without another seed request, and expiry hides the code and returns to the password form. Through the page, assert the mentor password grants access and logout clears the code. Do not test countdown text or internal timer state.

~~~tsx
jest.useFakeTimers().setSystemTime(new Date(270_000));
const onExpired = jest.fn();
render(<CodeDisplay secret={seed} expiresAt={270_000 + 43_200_000} onExpired={onExpired} />);
expect(await screen.findByText('0489')).toBeInTheDocument();
await act(async () => { jest.advanceTimersByTime(30_000); });
expect(await screen.findByText('3154')).toBeInTheDocument();
expect(fetch).not.toHaveBeenCalled();
jest.setSystemTime(new Date(270_000 + 43_200_000));
await act(async () => { jest.advanceTimersByTime(250); });
expect(screen.queryByText('3154')).not.toBeInTheDocument();
expect(onExpired).toHaveBeenCalledTimes(1);
~~~

- [ ] **Step 2: Run red tests.** Run `pnpm --filter web test -- CodeDisplay.test.tsx page.test.tsx`. Expected: missing components/route.
- [ ] **Step 3: Add the same-origin rewrite and test setup.** Rewrite `/api/attendance-display/:path*` to `API_INTERNAL_URL + '/api/attendance-display/:path*'` in `next.config.js`, like the existing auth rewrite. Add `Cache-Control: no-store` for the display route and seed API path. Extend Jest's `testMatch` to include `<rootDir>/app/**/*.(test|spec).{ts,tsx}` and add `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']`. The setup file imports `@testing-library/jest-dom`.

~~~js
{
  source: '/api/attendance-display/:path*',
  destination: apiInternalUrl + '/api/attendance-display/:path*',
}
~~~

~~~ts
import '@testing-library/jest-dom';
~~~
- [ ] **Step 4: Implement the display route and client.** The client posts the password to the login endpoint with `credentials: 'include'`, fetches the seed once after success or reload, and holds it only in React state. Use `generateAttendanceCode(secret, Date.now())` on mount and at each 30-second boundary; show the countdown. Use the returned `expiresAt` to clear the seed and code and show the password form after 12 hours. Include logout that calls the API and clears state. Do not write the seed to local storage or a browser cookie.

~~~tsx
const lastStep = useRef<number | null>(null);
const expired = useRef(false);
useEffect(() => {
  let active = true;
  const tick = async () => {
    const now = Date.now();
    if (now >= expiresAt) {
      setCode(null);
      if (!expired.current) {
        expired.current = true;
        onExpired();
      }
      return;
    }
    const step = Math.floor(now / 30_000);
    if (step !== lastStep.current) {
      lastStep.current = step;
      const next = await generateAttendanceCode(secret, now);
      if (active) setCode(next);
    }
    if (active) setSecondsLeft(Math.ceil((30_000 - now % 30_000) / 1000));
  };
  void tick();
  const timer = window.setInterval(() => { void tick(); }, 250);
  return () => { active = false; window.clearInterval(timer); };
}, [secret, expiresAt, onExpired]);
~~~
- [ ] **Step 5: Run green checks.** Run `pnpm --filter web test`, `pnpm --filter web check-types`, `pnpm --filter web build`, `pnpm --filter api test`, and `pnpm --filter api build`. Expected: all pass. In a local browser, confirm a code changes at rollover, both member commands accept it, a wrong code changes no attendance row, and the display requires login after session expiry.
- [ ] **Step 6: Document setup and commit.** Add the display URL and mentor configuration steps to `apps/dashboard/README.md`; update the API README with the three attendance env variables and a command to generate a random 20-byte Base32 seed. Run `git diff --check`. Stage only this task's files and commit with `git commit -m "feat(attendance): add facility TOTP display"`.

## Self-review notes

- Spec coverage: Task 1 owns algorithm and zero-padding; Task 2 owns verification and no-write rejection; Task 3 owns Discord validation, ephemeral replies, and command throttling; Task 4 owns password, session, seed access, and login throttling; Task 5 owns local rollover and expiry. Admin commands stay untouched.
- Existing main already contains attendance persistence and serializes writes with PostgreSQL advisory locks. This plan reuses it and does not add a database migration.
- Run each task's red test before implementation and its green checks before committing. At the end, run `pnpm test`, `pnpm check-types`, `pnpm lint`, and `pnpm build` from the repository root. If a pre-existing failure appears, record it with its exact command and output rather than folding unrelated changes into the feature.
