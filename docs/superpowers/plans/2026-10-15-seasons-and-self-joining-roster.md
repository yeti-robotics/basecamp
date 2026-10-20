# Seasons and Self-Joining Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one self-hosted team manage seasons and a restricted, self-joining roster with season-specific assignments.

**Architecture:** Keep Better Auth responsible for identity and sessions; enforce Discord admission before OAuth creates a user or session. NestJS owns season and roster rules, authorization, and audit writes. Next.js renders admin/mentor views from the API. A membership is unique per user and season, while the linked auth user persists across seasons.

**Tech Stack:** TypeScript, NestJS, Better Auth, Drizzle/PostgreSQL, Next.js, Vitest, Jest, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-15-seasons-and-self-joining-roster-design.md`

## Global Constraints

- One team per self-hosted installation; no team creation or tenant table.
- YETI's configured Discord server ID is `408711970305474560`; never hardcode it as a platform constant.
- Four season roles: `Team Admin`, `Mentor`, `Student Leader`, `Student`; store them as `team_admin | mentor | student_leader | student`. Student experience is independently `rookie | veteran`.
- New members join as Student/Rookie; returning roles and rookie progression follow the spec, including removal and gap rules.
- A new season starts empty; members appear on sign-in or their first authenticated visit after a season boundary.
- No attendance goals, outreach collection, event calendar, excuses, or mentor attendance actions in these PRs.
- Run `pnpm test` and `pnpm check-types` at the repository root before each PR is considered ready. Never reset or migrate a shared database during setup.

## Review Focus

1. Discord user outside the configured guild: OAuth produces neither a local user nor a session (Task 3).
2. Discord API outage or malformed response: admission fails closed with a useful error and no roster write (Task 3).
3. Season boundary while a browser session remains valid: first authenticated visit creates exactly one new membership (Task 6).
4. Removed membership or suspended account: a later visit cannot recreate the membership or access protected data (Tasks 6 and 8).
5. Adjacent or overlapping season dates, including a local timezone boundary: exactly one current season can be selected (Tasks 2 and 5).

## File Map and Stacked PR Boundaries

| PR | Deliverable | Main files |
| --- | --- | --- |
| 1 | Season/membership storage and assignment rules | `apps/api/src/database/schema/{seasons,enums}.ts`, new Drizzle migration, `apps/api/src/seasons/assignment.ts`, `season-dates.ts` |
| 2 | Discord admission and first-admin bootstrap | `apps/api/src/auth.ts`, `apps/api/src/auth/discord-admission.service.ts`, `apps/api/src/env.validation.ts`, auth tests and setup docs |
| 3 | Season API and admin page | `apps/api/src/seasons/{seasons.service,seasons.controller,seasons.module}.ts`, `apps/dashboard/app/seasons/*`, `apps/dashboard/lib/seasons.ts` |
| 4 | Self-enrollment and roster read | `apps/api/src/roster/{roster.service,roster.controller,roster.module}.ts`, `apps/dashboard/app/roster/*`, `apps/dashboard/lib/roster.ts` |
| 5 | Assignment corrections, removal, suspension, audit, recovery | roster service/controller, `apps/api/src/access/*`, `apps/api/scripts/recover-admin.mts`, roster page controls |

Use five `codex/` branches and open five PRs as a stack: `codex/seasons-model` targets the default branch; `codex/discord-admission` targets `codex/seasons-model`; `codex/season-management` targets `codex/discord-admission`; `codex/self-joining-roster` targets `codex/season-management`; `codex/roster-admin-actions` targets `codex/self-joining-roster`. Include the approved spec, this plan, and the local mockup ignore rule in the first PR, since they remain uncommitted after the earlier direct-to-`main` commit was rejected. Each PR description names its parent PR and includes only its own incremental diff. Keep the lower PRs stable while reviewing the upper ones; when a lower PR changes, rebase/retest descendants and update their bases after merges. Do not implement later PR behavior ahead of its boundary.

---

### Task 1 (PR 1): Persist season assignments and action history

**Files:**
- Modify: `apps/api/src/database/schema/seasons.ts`, `apps/api/src/database/schema/enums.ts`, `apps/api/src/database/schema/index.ts`
- Create: `apps/api/src/database/schema/roster-audit.ts`, next `apps/api/drizzle/0003_*.sql` and matching Drizzle metadata
- Test: `apps/api/src/database/schema/seasons.spec.ts`

**Interfaces:**
- Produces `seasons(id, name, starts_on, ends_on)` with date-only local values; `season_memberships(id, season_id, user_id, role, student_experience, state, joined_at, removed_at, legacy_status?)` with unique `(season_id,user_id)` and non-null foreign keys. `legacy_status` is read-only migration provenance.
- Produces `roster_audit(id, actor_user_id, subject_user_id, season_id?, action, before?, after?, reason?, created_at)` for admin changes. `state` is `active | removed`; experience is null for admin/mentor. `SeasonRole`, `StudentExperience`, and `MembershipState` TypeScript unions use the storage values in Global Constraints.
- Preserve old data. Map legacy `mentor` to Mentor, `rookie`/`veteran` to Student with corresponding experience, and legacy `alumni` to removed Student pending human correction. Retain historical legacy status in migration/audit data so the conversion is inspectable.

- [ ] **Step 1: Write the failing schema test.** Assert a membership requires a season and user, exposes the exact role/experience/state fields, and defines a unique season-user index; assert season fields are dates.
- [ ] **Step 2: Run `pnpm --filter api test -- seasons.spec.ts`.** Expect failure because the new columns/index do not exist.
- [ ] **Step 3: Update the schema and generate/review the migration.** Use `pnpm --filter api db:generate` with a disposable/local database URL; hand-check generated SQL to preserve rows and ensure existing `alumni` records are not accidentally made active. Do not run a migration against the shared database.
- [ ] **Step 4: Run the schema test, `pnpm test`, and `pnpm check-types` from root.** Expect pass; inspect migration SQL for row-preserving conversion and constraints.
- [ ] **Step 5: Commit this task on the PR branch.** Include schema, migration, metadata, and test.

### Task 2 (PR 1): Define season boundaries and assignment carry-forward

**Files:**
- Create: `apps/api/src/seasons/season-dates.ts`, `apps/api/src/seasons/season-dates.spec.ts`, `apps/api/src/seasons/assignment.ts`, `apps/api/src/seasons/assignment.spec.ts`

**Interfaces:**
- `defaultSeasonDates(startYear: number): { startsOn: string; endsOn: string }` returns May 15 through the following May 14.
- `isCurrentSeason(season: { startsOn: string; endsOn: string }, localDate: string): boolean` uses inclusive calendar dates; `overlaps(a,b): boolean` rejects shared days but accepts May 14/May 15 adjacency.
- `deriveAssignment(previous: { role: SeasonRole; studentExperience: StudentExperience | null; state: MembershipState; immediatelyPrevious: boolean } | null): { role: SeasonRole; studentExperience: StudentExperience | null }` implements the spec; a removed previous membership never revives an older admin role.

- [ ] **Step 1: Write failing tests.** Pin May 15/May 14 defaults, date adjacency and overlap, Student/Rookie first join, Student Leader/Rookie to Student Leader/Veteran in the next season, veteran persistence, skipped-rookie behavior, and removed-prior fallback.
- [ ] **Step 2: Run the two focused Vitest files.** Expect failures from missing helpers.
- [ ] **Step 3: Implement the named pure functions.** Keep timezone conversion at the API boundary; these functions accept local `YYYY-MM-DD` strings.
- [ ] **Step 4: Run focused tests, then `pnpm test` and `pnpm check-types` from root.** Expect pass.
- [ ] **Step 5: Commit this task on the PR branch.**

### Task 3 (PR 2): Reject unadmitted Discord OAuth identities

**Files:**
- Create: `apps/api/src/auth/discord-admission.service.ts`, `apps/api/src/auth/discord-admission.service.spec.ts`
- Modify: `apps/api/src/auth.ts`, `apps/api/src/auth/auth.module.ts`, `apps/api/src/env.validation.ts`, `apps/api/src/env.validation.spec.ts`, `apps/api/.env.example`, `apps/api/README.md`
- Test: `apps/api/src/auth/auth.module.spec.ts` (OAuth callback boundary)

**Interfaces:**
- `DiscordAdmissionService.verify(discordId: string): Promise<'allowed' | 'denied' | 'unavailable'>` checks the configured `DISCORD_GUILD_ID` through a server-held Discord bot token, with an explicit timeout.
- Add `DISCORD_GUILD_ID` and an admission bot token setting to validated API configuration. The operator may reuse the existing bot token value, but admission must not depend on starting Necord or the development-guild setting.
- Wire Better Auth's OAuth validation before user creation, account linking, and returning sign-in. `denied` and `unavailable` reject the callback; never derive admission from Discord nickname or email. Keep the provider-specific check replaceable for future web-only hosting.

- [ ] **Step 1: Write failing tests.** Cover a guild member, nonmember, timeout/Discord failure, invalid/missing configuration, and both new and returning OAuth identities. Assert nonmembers and failures create no user/session.
- [ ] **Step 2: Run the focused API tests.** Expect failure before admission wiring exists.
- [ ] **Step 3: Implement the service and OAuth boundary.** Verify the callback API against the installed Better Auth version; use the stable Discord profile ID. Handle phone-only Discord accounts without treating a fabricated email as an authorization signal.
- [ ] **Step 4: Run focused tests, then `pnpm test` and `pnpm check-types` from root.** Expect pass. In a development guild, verify a real admitted and denied sign-in without changing production data.
- [ ] **Step 5: Commit this task on the PR branch.**

### Task 4 (PR 2): Bootstrap the first Team Admin

**Files:**
- Create: `apps/api/src/access/bootstrap.service.ts`, `apps/api/src/access/bootstrap.service.spec.ts`
- Modify: `apps/api/src/env.validation.ts`, `apps/api/.env.example`, `apps/api/README.md`, `apps/api/src/auth.ts`

**Interfaces:**
- `BootstrapService.mayCreateFirstSeason(userId: string, discordId: string): Promise<boolean>` accepts a configured initial Discord ID only while no Team Admin membership exists.
- `BootstrapService.completeFirstSeason(userId: string, seasonId: number): Promise<void>` creates the first Team Admin membership transactionally, then makes the bootstrap setting ineffective. Store no permanent authorization in Better Auth's global `user.role`.

- [ ] **Step 1: Write failing tests.** Configured admitted Discord ID may create first season, an arbitrary or denied ID may not, and the configured ID loses special authority once an admin membership exists.
- [ ] **Step 2: Run the focused bootstrap test.** Expect failure.
- [ ] **Step 3: Implement bootstrap service and configuration.** Accept a comma-separated `BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS` list; validate each ID as a Discord snowflake and document removal after setup.
- [ ] **Step 4: Run focused tests, then root `pnpm test` and `pnpm check-types`.** Expect pass.
- [ ] **Step 5: Commit this task on the PR branch.**

### Task 5 (PR 3): Create and edit seasons through a protected API and page

**Files:**
- Create: `apps/api/src/seasons/seasons.service.ts`, `apps/api/src/seasons/seasons.controller.ts`, `apps/api/src/seasons/seasons.module.ts`, `apps/api/src/seasons/seasons.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/env.validation.ts`, `apps/api/.env.example`, `apps/api/README.md`
- Create: `apps/dashboard/lib/seasons.ts`, `apps/dashboard/app/seasons/page.tsx`, `apps/dashboard/app/seasons/SeasonManager.tsx`, `apps/dashboard/app/seasons/SeasonManager.test.tsx`
- Modify: `apps/dashboard/next.config.js`

**Interfaces:**
- `SeasonsService.list(): Promise<Season[]>`, `current(now: Date): Promise<Season | null>`, `create(input: { name: string; startsOn: string; endsOn: string }, actorId: string): Promise<Season>`, `update(id: number, input: ... , actorId: string): Promise<Season>`.
- API: `GET /api/seasons` for roster viewers; `POST /api/seasons` and `PATCH /api/seasons/:id` for Team Admins. The initial bootstrap user may only create the first season. Browser mutations use a same-origin `/api/seasons/*` proxy; API rechecks authorization and dates.
- `BASECAMP_TIME_ZONE` is a validated IANA timezone, set by the operator (YETI example: `America/New_York`). Local start/end dates are inclusive; reject invalid and overlapping ranges in a transaction.

- [ ] **Step 1: Write failing API and page tests.** Cover first-season bootstrap, a prior Team Admin creating the next season during a gap, admin-only edits, mentor read-only access, ordered dates, overlap/adjacency, local date boundary, and a season with memberships retaining its records after a date edit.
- [ ] **Step 2: Run the focused API and Jest tests.** Expect failure.
- [ ] **Step 3: Implement the API and season page.** Show current/past/future seasons, suggested May 15/May 14 dates, and editable name/dates. Return a clear no-current-season state to ordinary members.
- [ ] **Step 4: Run focused tests, then root `pnpm test` and `pnpm check-types`.** Expect pass.
- [ ] **Step 5: Commit this task on the PR branch.**

### Task 6 (PR 4): Enroll admitted members once per season

**Files:**
- Create: `apps/api/src/roster/roster.service.ts`, `apps/api/src/roster/roster.service.spec.ts`, `apps/api/src/roster/roster.module.ts`
- Create: `apps/api/src/roster/member-context.service.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/attendance/attendance.controller.ts`, `apps/api/src/seasons/seasons.controller.ts`, `apps/api/src/roster/roster.controller.ts`, `apps/dashboard/app/page.tsx`

**Interfaces:**
- `RosterService.ensureCurrentMembership(userId: string, now: Date): Promise<SeasonMembership | null>` returns null when no season is current; otherwise rechecks admission and inserts atomically only if no row exists. A removed row remains removed. The unique database index resolves concurrent visits.
- `RosterService.getOwnCurrent(userId: string, now: Date): Promise<SeasonMembership | null>` returns only the caller's current membership.
- `MemberContextService.authenticate(headers: IncomingHttpHeaders): Promise<string>` resolves the Better Auth session, calls `ensureCurrentMembership`, and returns the user ID. Use it in dashboard-facing attendance, season, and roster API endpoints; this covers sessions spanning season rollover without requiring a fresh OAuth login. Task 8 adds the suspension check to this shared boundary.

- [ ] **Step 1: Write failing service and HTTP tests.** Cover first Student/Rookie, returning role and experience, missing season, duplicate/concurrent visits, session crossing season boundary, guild rejection during rollover, and removed-row non-recreation.
- [ ] **Step 2: Run the focused tests.** Expect failure.
- [ ] **Step 3: Implement transactional enrollment and its shared request boundary.** Keep existing attendance overview behavior intact for a signed-in nonmember where no current season exists.
- [ ] **Step 4: Run focused tests, then root `pnpm test` and `pnpm check-types`.** Expect pass.
- [ ] **Step 5: Commit this task on the PR branch.**

### Task 7 (PR 4): Show the current and historical roster to authorized viewers

**Files:**
- Create: `apps/api/src/roster/roster.controller.ts`, `apps/api/src/roster/roster.controller.spec.ts`, `apps/dashboard/lib/roster.ts`, `apps/dashboard/app/roster/page.tsx`, `apps/dashboard/app/roster/RosterTable.tsx`, `apps/dashboard/app/roster/RosterTable.test.tsx`
- Modify: `apps/api/src/roster/roster.module.ts`, `apps/dashboard/next.config.js`

**Interfaces:**
- API: `GET /api/roster/current` returns the full current list to Team Admins/Mentors; `GET /api/roster/seasons/:seasonId` returns a read-only past list to Team Admins; `GET /api/roster/me` returns the caller's assignment. No list endpoint returns removed members by default; admins can request `?includeRemoved=true` for restoration.

- [ ] **Step 1: Write failing API and page tests.** Mentor/admin can read the current roster, only admin can read past rosters, Student/Student Leader cannot enumerate, a member can view only self, an empty new season is shown as empty, and prior seasons retain their assignments.
- [ ] **Step 2: Run focused tests.** Expect failure.
- [ ] **Step 3: Implement read API and page.** Display role plus rookie/veteran where applicable, and distinguish current from historical seasons without copying the prior roster.
- [ ] **Step 4: Run focused tests, then root `pnpm test` and `pnpm check-types`.** Expect pass.
- [ ] **Step 5: Commit this task on the PR branch.**

### Task 8 (PR 5): Correct assignments, remove/restore, and suspend access

**Files:**
- Create: `apps/api/src/access/access.service.ts`, `apps/api/src/access/access.service.spec.ts`, `apps/api/scripts/recover-admin.mjs`
- Modify: `apps/api/src/roster/roster.service.ts`, `apps/api/src/roster/roster.controller.ts`, `apps/api/src/roster/roster.controller.spec.ts`, `apps/api/src/roster/member-context.service.ts`, `apps/api/src/auth.ts`, `apps/dashboard/app/roster/RosterTable.tsx`, `apps/dashboard/app/roster/RosterTable.test.tsx`, `apps/api/README.md`

**Interfaces:**
- API: `PATCH /api/roster/members/:id` accepts current-season role/experience corrections; `PATCH /api/roster/seasons/:seasonId/members/:id` explicitly corrects a past-season assignment; `POST /api/roster/members/:id/remove` and `/restore` change only that season; `POST /api/access/users/:userId/suspend` and `/restore` change account-wide access. Every mutation requires Team Admin authority, writes actor/timestamp/before/after audit, and rejects actions that leave zero effective admins.
- `AccessService.isSuspended(userId: string): Promise<boolean>` reads Better Auth's existing `user.banned` field and is checked at sign-in and in `MemberContextService`. Suspension sets `user.banned`, records a reason, and revokes all of the user's sessions in the same operation. Restoration clears the ban. The operator-only recovery command grants Team Admin to a known local account and records the action.

- [ ] **Step 1: Write failing API and page tests.** Cover authorized current and explicit historical corrections, mentor/student rejection, experience required only for student roles, audit records, removed-member non-rejoin, restore, suspended-session rejection, failed sign-in while suspended, and last-admin protection.
- [ ] **Step 2: Run focused tests.** Expect failure.
- [ ] **Step 3: Implement mutations, suspension, audit, recovery command, and UI controls.** Keep season removal and account suspension visibly distinct; preserve all historical memberships and attendance.
- [ ] **Step 4: Run focused tests, then root `pnpm test` and `pnpm check-types`.** Expect pass. Check the recovery command against a disposable local database only.
- [ ] **Step 5: Commit this task on the PR branch.**

## Final Verification Before Each PR

- Check the PR diff for migration data loss, accidental Better Auth admin API exposure, authorization on every API route, and sensitive Discord token output.
- Run `pnpm test` and `pnpm check-types` from the repository root. Run no database reset or migration against a shared database.
- At the top of the finished stack, exercise the main flow in a development guild: bootstrap admin, create season, new Student/Rookie joins, returning role carries, admin correction persists, removal blocks rejoin, and suspension ends access. Earlier PRs need only exercise the behavior they introduce.
- Open a PR only for its listed deliverable; link this plan and the approved spec in the description.
