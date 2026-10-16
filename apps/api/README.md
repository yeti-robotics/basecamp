# Basecamp API

NestJS API for Basecamp authentication, attendance, and Discord commands.

## Run locally

From the repository root, install dependencies and configure `apps/api/.env` as described below. Run the API through Turbo so its workspace packages build first:

```bash
pnpm install
pnpm dev --filter=api
```

For the Node debugger, run `pnpm exec turbo run dev:debug --filter=api`. To build and run the compiled API:

```bash
pnpm build --filter=api
pnpm --filter api start:prod
```

Run the API tests with `pnpm --filter api test` or `pnpm --filter api test:e2e`. Use `pnpm --filter api test:cov` for coverage.

## Database and authentication

The API owns the PostgreSQL connection pool, Better Auth, and database migrations. The API process creates one pool with a maximum of 10 connections, a 5-second connection timeout, and a 30-second idle timeout. The pool closes during Nest application shutdown, so the deployment's total possible connections are the per-process limit multiplied by the number of API instances.

Copy `.env.example` to `.env` for local development. The API validates its environment at startup. Set `DATABASE_URL` to a PostgreSQL URL, `BETTER_AUTH_SECRET` to a random value of at least 32 characters (for example, `openssl rand -base64 32`), `BETTER_AUTH_URL` to the public dashboard URL, and provide the Discord client ID and secret. `DISCORD_GUILD_ID` and `DISCORD_ADMISSION_BOT_TOKEN` are required for OAuth admission. The bot must be a member of that server; set the admission token to the same value as `DISCORD_TOKEN` if you use one bot for both jobs. The direct membership check does not depend on Necord or `DISCORD_DEVELOPMENT_GUILD_ID`. Discord OAuth sign-in and account linking are rejected when membership is absent or Discord cannot be reached. Members without a Discord email can still sign in; Basecamp stores a non-deliverable placeholder email derived from their stable Discord ID, and never uses email for admission. `DISCORD_TOKEN` and `DISCORD_DEVELOPMENT_GUILD_ID` remain optional, but must be set together to enable the Discord attendance bot. `PORT` defaults to `8000`. The dashboard separately uses `API_INTERNAL_URL` to reach NestJS over the private network; set it in `apps/dashboard/.env.local`.

To establish the first Team Admin, set `BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS` to a comma-separated list of Discord user IDs for admitted mentors. The setting only grants first-admin setup authority while no Team Admin membership exists. After the first Team Admin membership is recorded, remove the setting; roster assignments then control all permissions.

Set `BASECAMP_TIME_ZONE` to the team's IANA timezone (for example, `America/New_York`). Season dates are local calendar dates, and API authorization selects the current season using this timezone.

## Facility attendance display

Set these API environment variables before starting the API:

- `ATTENDANCE_TOTP_SECRET`: one shared Base32 seed of at least 20 bytes. The API verifies attendance codes and gives this seed only to an unlocked facility display.
- `ATTENDANCE_DISPLAY_PASSWORD`: a mentor-chosen password for `/attendance/display`.
- `ATTENDANCE_DISPLAY_SESSION_SECRET`: a separate random signing secret of at least 32 characters for 12-hour display sessions. Changing it signs out every display.

Generate a seed and signing secret with:

```bash
python3 -c 'import base64,secrets; print(base64.b32encode(secrets.token_bytes(20)).decode().rstrip("="))'
openssl rand -base64 32
```

Members enter the four-digit code currently shown at the facility with `/signin` or `/signout` in Discord. It changes every 30 seconds and is padded with zeros when needed. The API accepts the previous and next 30-second windows to allow for small clock differences. The display obtains the seed after password login and computes later codes in the browser; keep that page on a trusted facility device. The login uses Nest Throttler's in-memory storage, limited to five attempts per 15 minutes per API-observed IP. Discord code submissions share a separate five-attempt-per-minute limit per member across both commands. These limits assume a single API instance.

If the dashboard reaches the API through a trusted reverse proxy, set `ATTENDANCE_TRUSTED_PROXY` to that proxy's exact IP address or CIDR (`loopback` for a same-host dashboard). This lets Express use the forwarded client address, so one visitor cannot consume the facility display's login bucket. The public ingress in front of Next must discard client-supplied `X-Forwarded-For` and set or append the actual client address; Next's rewrite forwards that header. Do not enable proxy trust if that boundary is not enforced. With the setting absent, the API ignores forwarded addresses and all visitors through one dashboard proxy share a login bucket.

Generate and review migrations from the repository root:

```bash
pnpm --filter api db:generate --name=describe_the_change
pnpm --filter api db:migrate
```

To delete and recreate the local `basecamp` database, then apply all migrations, run `pnpm --filter api db:nuke`. This command only accepts a loopback PostgreSQL URL whose database name is `basecamp`. All data in that database is deleted.

Commit the generated SQL, migration journal, and snapshot. Deployment applies pending migrations once, before rolling out API instances. The API does not migrate the database during application startup.
