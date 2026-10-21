# Optional Discord Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Basecamp usable without a Discord bot credential while giving Team Admins a persistent, live switch and write-only token control for the interactive bot.

**Architecture:** Move admission to Discord user OAuth. Run Necord in a separately created Nest application context inside the API process so the HTTP application can open and close the bot context. Persist desired state and an encrypted token in PostgreSQL; guard settings routes with Nest session and Team Admin guards.

**Tech Stack:** NestJS 12, Better Auth 1.7.4, Discord OAuth2 and discord.js 14, Necord 7, Drizzle/PostgreSQL, Next.js 16, Vitest, Jest.

**Spec:** `docs/superpowers/specs/2026-10-20-optional-discord-bot-design.md`

## Global Constraints

- Build from `origin/main` at or after `1c48ff8`; preserve the existing Team Admin bootstrap, suspension, and season-role rules.
- A new installation starts with the interactive bot off; every later API start applies the last saved setting, including on.
- OAuth client credentials, `DISCORD_GUILD_ID`, and development-only `DISCORD_DEVELOPMENT_GUILD_ID` stay outside portal settings. The portal stores only the interactive bot token.
- Admission must reject a known nonmember and fail closed on an uncertain Discord result before issuing a session or adding a season membership.
- A bot connection failure must never stop the HTTP API. The token must never appear in read responses, logs, errors, or rendered page data.
- Use the existing effective `team_admin` season permission, not Better Auth's global `user.role`. Protect API routes server-side; UI hiding is supplementary.
- Keep the bot in the existing API process. This work does not add containers or change deployment setup.
- Use existing shadcn primitives for the portal. Install missing primitives with the repository's configured shadcn CLI; do not hand-build a switch, input, label, or other primitive.
- Node.js is `>=20.19`, pnpm is `12.10.0`. Run `pnpm test` and `pnpm check-types` from the repository root. No migrations or database resets in worktree setup.

## Review Focus

1. **Old OAuth grant without `guilds.members.read`:** reject sign-in with a usable reauthorization path; Task 1 pins this.
2. **Mismatched or malformed guild-member response:** treat as unavailable, never as admitted; Task 1 pins this.
3. **Revoked or unrefreshable linked user token at a season boundary:** do not add a roster membership; Task 2 pins this.
4. **Two rapid admin toggle/token requests:** serialize reconciliation and keep at most one Discord connection; Task 4 pins this.
5. **Enabled state with an invalid token on restart:** keep HTTP serving, retain desired on, and report failed without revealing the token; Task 4 pins this.

---

## File map and PR stack

| PR | Files | Responsibility |
| --- | --- | --- |
| 1: OAuth admission | `apps/api/src/auth/discord-admission.service.ts`, `apps/api/src/auth.ts`, `apps/api/src/auth/linked-discord-admission.service.ts`, `apps/api/src/auth/linked-discord-admission.module.ts` | Verify guild membership with the user's OAuth access token at callback and for an existing linked account. |
| 1: callers | `apps/api/src/access/bootstrap.service.ts`, `apps/api/src/roster/roster.service.ts`, their modules/tests, `apps/api/src/env.validation.ts`, `apps/api/.env.example`, `apps/api/README.md` | Replace bot-token admission, preserve bootstrap and season enrollment, and remove the obsolete required secret. |
| 2: state | `apps/api/src/database/schema/bot-settings.ts`, generated `apps/api/drizzle/*`, `apps/api/src/bot/bot-settings.store.ts`, `apps/api/src/bot/bot-token-cipher.ts` | Persist one desired-enabled flag and a write-only encrypted token. |
| 2: runtime | `apps/api/src/bot/discord-commands.module.ts`, `apps/api/src/bot/bot-context.module.ts`, `apps/api/src/bot/bot-context.factory.ts`, `apps/api/src/bot/bot-runtime.service.ts`, `apps/api/src/bot/bot.module.ts`, `apps/api/src/app.module.ts`, `apps/api/src/attendance/attendance.module.ts`, `apps/api/src/lifecycle/lifecycle.module.ts` | Keep Necord and command providers in an independently closable Nest context; reconcile saved state. |
| 2: access | `apps/api/src/access/session.guard.ts`, `apps/api/src/access/team-admin.guard.ts`, `apps/api/src/bot/bot.controller.ts`, `apps/api/src/bot/bot.dto.ts`, module/test files | Authenticate with Better Auth, authorize with the effective Team Admin role, validate requests, and expose safe status/mutations. |
| 3: portal | `apps/dashboard/app/settings/bot/page.tsx`, `apps/dashboard/app/settings/bot/BotSettings.tsx`, `apps/dashboard/lib/bot-settings.ts`, `apps/dashboard/components/ui/{switch,input,label}.tsx`, `apps/dashboard/next.config.js`, dashboard navigation/tests | Give Team Admins the token and switch controls with observed status, using shadcn primitives. |
| 3: configuration docs | `apps/api/.env.example`, `apps/api/README.md`, root `README.md` | Explain bot-free startup, required settings, and encryption-key backup alongside the portal controls. |

Use one `codex/` branch per PR, stacked in that order. PR 1 targets current main; PR 2 targets PR 1; PR 3 targets PR 2. Include the approved spec and this plan in PR 1. Do not commit copied `.env` files. Each task below ends with a focused commit; PR boundaries are review gates.

For the new HTTP surface, follow Nest's documented guard pattern: DI-provided `CanActivate` classes, authentication before authorization, controller-level `@UseGuards`, identity attached to the current request, and DTO validation pipes. Keep Better Auth as the session provider; adding a second auth framework would create a competing source of truth. The app has public health and OAuth routes, so do not turn the new guards into global guards. See [Nest guards](https://docs.nestjs.com/guards) and [lifecycle hooks](https://docs.nestjs.com/fundamentals/lifecycle-events).

## PR 1 — User OAuth admission

### Task 1: Admit at the OAuth callback with the user's token

**Files:** Modify `apps/api/src/auth/discord-admission.service.ts`, `apps/api/src/auth.ts`, `apps/api/src/auth/discord-admission.service.spec.ts`, `apps/api/src/auth/auth.module.spec.ts`; create `apps/api/test/discord-oauth-admission.e2e-spec.ts`.

**Interfaces:** Produce `DiscordAdmissionService.verify(accessToken: string, discordId: string): Promise<'allowed' | 'denied' | 'unavailable'>`. In the Discord provider, request `guilds.members.read`; custom `getUserInfo(tokens)` fetches `/users/@me`, calls `verify` with the same user token and profile ID, and passes the result in server-fetched profile data to the existing `validateUserInfo` gate. Preserve the current profile name/image and phone-only email mapping.

- [x] **Step 1: Write failing tests.** Assert `GET /users/@me/guilds/{DISCORD_GUILD_ID}/member` uses `Bearer <user token>`; valid matching member allows `create-user`, `sign-in`, and `link-account`; 404 denies; 401/403, missing scope, timeout, mismatched ID, and malformed JSON return unavailable; no rejected callback creates a user or session. Assert the authorization URL requests `guilds.members.read` and never `bot`.
- [x] **Step 2: Run the focused tests to see the failure.** Run `pnpm --filter api test -- src/auth/discord-admission.service.spec.ts src/auth/auth.module.spec.ts` and `pnpm --filter api test:e2e -- discord-oauth-admission.e2e-spec.ts`; expect the new assertions to fail against bot-token admission.
- [x] **Step 3: Implement the interface.** Use the installed Better Auth 1.7.4 `getUserInfo` and `validateUserInfo` hooks. Keep the verified admission marker server-created and scoped to this callback; never derive it from email or a client parameter. A missing scope must produce an explicit reauthorization message. Retain the suspended-account gate.
- [x] **Step 4: Rerun the focused tests.** Both commands above pass.
- [x] **Step 5: Commit.** Stage only Task 1 files and commit `feat(auth): verify Discord admission with user OAuth` (`7eedc7c`).

### Task 2: Recheck linked accounts without a bot token

**Files:** Create `apps/api/src/auth/linked-discord-admission.service.ts`, `apps/api/src/auth/linked-discord-admission.module.ts` and service tests; modify `apps/api/src/access/bootstrap.service.ts`, `apps/api/src/roster/roster.service.ts`, their tests/modules, `apps/api/src/env.validation.ts` and tests, `apps/api/.env.example`, `apps/api/README.md`.

**Interfaces:** Produce `LinkedDiscordAdmissionService.verifyLinked(userId: string, discordId: string): Promise<'allowed' | 'denied' | 'unavailable'>`. Select the exact Better Auth `account.id` linked to `(userId, providerId='discord', accountId=discordId)`, call server-side `auth.api.getAccessToken({body:{accountId,userId}})` so Better Auth can refresh it, then call Task 1's `verify(accessToken, discordId)`. A missing account/token/refresh or Discord error is unavailable. Place this service in a module importing `AuthModule` and `DatabaseModule`; do not inject `AUTH` into `DiscordAdmissionService` and create a provider cycle.

- [x] **Step 1: Write failing tests.** The bootstrap configured Discord ID and a member crossing seasons succeed with a valid linked user token. A revoked/unrefreshable token adds no season membership; a nonmember is denied; an unrelated account ID cannot be used. Existing membership remains readable during an outage. Env validation accepts startup without `DISCORD_ADMISSION_BOT_TOKEN`.
- [x] **Step 2: Run the focused tests to see the failure.** Run `pnpm --filter api test -- src/access/bootstrap.service.spec.ts src/roster/roster.service.spec.ts src/env.validation.spec.ts`; expect the new tests to fail.
- [x] **Step 3: Implement the interface and update callers.** Preserve the existing 403 vs 503 admission meaning. Remove required admission-bot-token config and docs. Keep OAuth client credentials and `DISCORD_GUILD_ID` required.
- [x] **Step 4: Verify PR 1.** Run `pnpm test` and `pnpm check-types` from the repo root; both pass. Review auth callback behavior with both a new and returning account. `pnpm --filter api build` passes.
- [x] **Step 5: Commit and open PR 1.** Commit Task 2 as `feat(auth): recheck roster admission with linked OAuth` (`0e8ab59`) and open [PR 1](https://github.com/yeti-robotics/basecamp/pull/37) with the spec and plan. Do not start PR 2 until PR 1 is reviewable.

## PR 2 — Controllable Nest bot runtime

### Task 3: Persist encrypted desired state and token

**Files:** Create `apps/api/src/database/schema/bot-settings.ts`, generated Drizzle migration, `apps/api/src/bot/bot-token-cipher.ts`, `apps/api/src/bot/bot-settings.store.ts`, and tests; modify `apps/api/src/database/schema/index.ts`, `apps/api/src/env.validation.ts` and tests.

**Interfaces:** `BotSettingsStore.load(): Promise<{enabled:boolean; tokenCiphertext:string|null}>`, `setEnabled(enabled:boolean):Promise<void>`, `setToken(ciphertext:string):Promise<void>` operate on a single row (`id=1`) with `enabled=false` if absent. `BotTokenCipher.encrypt(token:string):string` and `decrypt(ciphertext:string):string` use authenticated encryption with a random nonce; `BOT_SETTINGS_ENCRYPTION_KEY` is a base64-encoded 32-byte key held outside the database. It is optional for bot-free startup, but required to save/decrypt a token. Never expose plaintext from the store or log decryption errors with ciphertext.

- [ ] **Step 1: Write failing tests.** Assert no row means disabled; token save alone does not enable; on and off persist across new store instances; ciphertext differs for repeated encryption of one token; wrong/missing key fails closed without exposing token; migration creates a singleton-capable table without changing attendance/roster data.
- [ ] **Step 2: Run the focused tests to see the failure.** Run `pnpm --filter api test -- src/bot/bot-token-cipher.spec.ts src/bot/bot-settings.store.spec.ts src/env.validation.spec.ts`; expect the new tests to fail.
- [ ] **Step 3: Add schema, migration, and services.** Generate the migration with `pnpm --filter api db:generate`; inspect the SQL and journal. Do not run a migration or reset against the shared database during setup.
- [ ] **Step 4: Rerun focused tests and type checks.** Focused tests and `pnpm check-types` pass.
- [ ] **Step 5: Commit.** Stage only Task 3 files and commit `feat(bot): persist encrypted bot settings`.

### Task 4: Start and stop Necord without affecting HTTP

**Files:** Create `apps/api/src/bot/discord-commands.module.ts`, `apps/api/src/bot/bot-context.module.ts`, `apps/api/src/bot/bot-context.factory.ts`, `apps/api/src/bot/bot-runtime.service.ts`, `apps/api/src/bot/bot.module.ts`, tests; modify `apps/api/src/app.module.ts`, `apps/api/src/attendance/attendance.module.ts`, `apps/api/src/lifecycle/lifecycle.module.ts`, their tests, and any command dependency exports.

**Interfaces:** `BotContextFactory.start(token:string, developmentGuildId?:string):Promise<INestApplicationContext>` creates `NestFactory.createApplicationContext(BotContextModule.forToken(...))`; `context.close()` destroys Necord. The child module owns `NecordModule.forRoot`, attendance/lifecycle command providers, and their service dependencies. `BotRuntimeService` implements `OnApplicationBootstrap`/`OnApplicationShutdown`; `status():Promise<{desiredEnabled:boolean;tokenConfigured:boolean;connection:'off'|'connecting'|'connected'|'failed';message?:string}>`, `setEnabled(enabled:boolean):Promise<BotStatus>`, and `replaceToken(token:string):Promise<BotStatus>`. Serialize all reconciliations; desired state is persisted before connection work. Startup schedules reconciliation without waiting for a Discord login, so HTTP can listen.

- [ ] **Step 1: Write failing tests.** AppModule never imports Necord; a new installation makes no login call; saved off remains off; saved on starts once after restart; disabling closes the child context; replacing a token while on closes then reopens it; two rapid changes never create two live contexts; invalid token at restart yields `failed` with desired on while an HTTP health request still succeeds; a partial context is closed after login failure; reapplying enabled after a failure retries; production startup works without a development guild ID; shutdown closes the context.
- [ ] **Step 2: Run the focused tests to see the failure.** Run `pnpm --filter api test -- src/app.module.spec.ts src/bot/bot-runtime.service.spec.ts src/bot/bot-context.factory.spec.ts`; expect the new tests to fail.
- [ ] **Step 3: Move command providers to the child module and implement the runtime.** Export `AttendanceService` and `LifecycleService` from their existing feature modules. Keep Nest DI ownership explicit; do not instantiate command classes or guards manually. Use Necord's own application bootstrap/shutdown inside the child context, closing a partially started context on failure. A missing token rejects enabling; a bad token leaves desired on and observed failed. Avoid logging the token or raw Discord error bodies.
- [ ] **Step 4: Rerun focused tests and type checks.** Focused tests and `pnpm check-types` pass.
- [ ] **Step 5: Commit.** Stage only Task 4 files and commit `feat(bot): reconcile an optional Nest bot context`.

### Task 5: Add conventional Nest guards and settings API

**Files:** Create `apps/api/src/access/session.guard.ts`, `apps/api/src/access/team-admin.guard.ts`, guard tests, `apps/api/src/bot/bot.controller.ts`, `apps/api/src/bot/bot.dto.ts`, `apps/api/src/bot/bot.controller.spec.ts`, `apps/api/test/bot-settings.e2e-spec.ts`; modify `apps/api/src/access/access.module.ts`, `apps/api/src/bot/bot.module.ts`.

**Interfaces:** `SessionGuard.canActivate(context:ExecutionContext):Promise<boolean>` calls Better Auth `getSession` from request headers, rejects missing/suspended sessions with 401, and places only `authUserId` on the request. `TeamAdminGuard.canActivate(context:ExecutionContext):Promise<boolean>` reads that ID and checks `SeasonAuthorizationService.accessFor(id).canManage`, rejecting a nonadmin with 403. Apply `@UseGuards(SessionGuard, TeamAdminGuard)` to the whole `BotController`; use DI-registered guard classes, not instances. Endpoints: `GET /api/settings/bot`, `PUT /api/settings/bot/token` with `{token:string}`, `PUT /api/settings/bot/enabled` with `{enabled:boolean}`. Use DTO classes and `ValidationPipe({whitelist:true,forbidNonWhitelisted:true})` on write bodies, plus `Cache-Control: private, no-store`.

- [ ] **Step 1: Write failing tests.** Nest HTTP tests assert missing/suspended session 401, member/mentor/bootstrap-only actor 403, effective active Team Admin allowed, malformed/extra body fields 400, missing token rejected, repeated enable/disable idempotent, and every read/write response excludes plaintext/ciphertext. Include a forged `user.role='admin'` with season role `student` that remains forbidden.
- [ ] **Step 2: Run the focused tests to see the failure.** Run `pnpm --filter api test -- src/access/session.guard.spec.ts src/access/team-admin.guard.spec.ts src/bot/bot.controller.spec.ts` and `pnpm --filter api test:e2e -- bot-settings.e2e-spec.ts`; expect the new assertions to fail.
- [ ] **Step 3: Implement guards, DTOs, controller, and module wiring.** Keep session authentication and Team Admin authorization in separate guards so Nest runs them in that order. Do not trust a role or user ID sent by the browser. Use one controller-level guard declaration for all settings routes.
- [ ] **Step 4: Verify PR 2.** Run `pnpm test` and `pnpm check-types` from the repo root; both pass. Review the migration SQL and test that the API starts without Discord.
- [ ] **Step 5: Commit and open PR 2.** Commit `feat(bot): guard admin bot settings API` and open PR 2 against PR 1.

## PR 3 — Team Admin portal

### Task 6: Build the Team Admin portal control

**Files:** Create `apps/dashboard/app/settings/bot/page.tsx`, `apps/dashboard/app/settings/bot/BotSettings.tsx`, `apps/dashboard/lib/bot-settings.ts`, component tests; install shadcn `apps/dashboard/components/ui/switch.tsx`, `input.tsx`, and `label.tsx`; modify `apps/dashboard/next.config.js`, dashboard navigation, `apps/api/.env.example`, `apps/api/README.md`, and root `README.md` as needed.

**Interfaces:** `getBotStatus():Promise<BotStatus|null>` forwards the session cookie server-side with `cache:'no-store'`. The client calls same-origin `/api/settings/bot/token` and `/api/settings/bot/enabled`; Next rewrites those paths to the private API. The page requires a session and an API-authorized status response; a 403 gets a neutral no-access view. The token input is write-only and clears after save. Render desired on/off separately from observed connection and poll while connecting/failed, stopping when the page unmounts.

- [ ] **Step 1: Write failing tests.** A Team Admin sees configured/unconfigured and connection states; saving a token does not turn the bot on; enabling after token save shows connecting/connected or failed; disabling shows off; nonadmins cannot reach controls; the saved token never appears in rendered HTML, input value, or status fetch data; duplicate clicks do not issue duplicate writes; the shadcn switch has an accessible label and supports keyboard activation.
- [ ] **Step 2: Run the focused tests to see the failure.** Run `pnpm --filter web test -- BotSettings.test.tsx`; expect the new tests to fail.
- [ ] **Step 3: Install the missing primitives.** Run `pnpm --filter web exec shadcn add switch input label` using `apps/dashboard/components.json`; check that the generated components land under `apps/dashboard/components/ui/`.
- [ ] **Step 4: Implement the page.** Reuse the installed Button, Card, Alert, Switch, Input, and Label components. Add the client control, server fetch, navigation, and rewrite. Keep permission enforcement in the API guards from Task 5. Present a failed connection with a retry action that reapplies the saved enabled setting; never display raw Discord error text.
- [ ] **Step 5: Update configuration docs.** Explain bot-free `pnpm dev`, the encryption key and backup consequence, default-off and restart behavior, and how a failed Discord connection leaves the API usable. Remove obsolete interactive `DISCORD_TOKEN` documentation.
- [ ] **Step 6: Verify PR 3.** Run focused tests, `pnpm test`, and `pnpm check-types` from the repo root; all pass. Check the documented environment variables against final validation.
- [ ] **Step 7: Commit and open PR 3.** Commit `feat(portal): manage interactive Discord bot` and open PR 3 against PR 2. Review each PR's diff separately; rebase and retest descendants if a lower PR changes.

## Final handoff

After the stack is implemented, review all three PR diffs for authentication bypasses, token exposure, restart behavior, and unrelated changes. Verify the linked PR stack and its test results. Portal attendance sign-in/sign-out and configurable auth providers remain separate future work.
