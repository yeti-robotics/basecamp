# Optional Discord bot and OAuth admission

## Intent

Basecamp's API and portal must remain usable when its interactive Discord bot is off. Local development should start without a bot connection, and a self-hosted Team Admin should be able to turn the bot on or off from the portal without restarting the API. The bot is an optional way to use Basecamp, not the application's operating dependency. Attendance sign-in and sign-out through the portal will follow in later work.

This work is a stack of manageable pull requests. The first removes the bot credential from Discord membership admission. The next makes the bot connection independently controllable. The last gives Team Admins a portal control for the connection and its token. The stack should leave each lower PR independently useful and reviewable.

## Goals

- An installation can run the API and portal, including Discord OAuth sign-in and roster access, without starting the interactive bot or supplying its token.
- Discord server membership admission uses the signing-in person's OAuth authorization, rather than a bot token. Existing admission and suspension rules continue to reject unauthorized sign-ins before a session is issued.
- A fresh installation starts with the interactive bot off. Saving a token alone leaves it off. After an administrator changes the setting, every API restart restores that last saved on/off setting and attempts to connect if it was on. A Team Admin can change the live Discord connection from the portal without an API restart.
- A Team Admin can enter or replace the interactive bot token in the portal. The portal shows whether a token is configured and whether the bot is connected, connecting, disconnected, or failed; it never returns the token value.
- A failed connection or bad token leaves the API and portal running and gives the Team Admin a useful status. Turning the bot off makes its Discord commands unavailable promptly.
- The setup documentation explains local bot-free development and the settings needed for the existing API and portal deployment.

## Non-goals and anti-goals

- Portal attendance sign-in/sign-out and parity for all other Discord commands are follow-up work. This stack must not claim that every action is already available in the portal.
- Configurable authentication providers and management of the Discord OAuth client ID or secret in the portal are out of scope.
- The development guild ID is an environment/development setting, not a portal secret. The team admission guild ID remains an installation setting.
- No new container or deployment setup is part of this work. The switch controls the bot connection inside the existing API process.
- Do not allow a bot startup failure to prevent the HTTP API from serving requests. Do not expose a bot token through read APIs, logs, errors, audit events, or client-rendered page data.

## Current repository state

The design is based on `origin/main` at `1c48ff8`. The API currently includes `NecordModule.forRoot` only when `DISCORD_TOKEN` and `DISCORD_DEVELOPMENT_GUILD_ID` are both present at process startup. This makes local bot startup optional already, but does not provide a runtime switch. The interactive command providers live inside the attendance and lifecycle modules.

At planning time, the newer main branch already had Discord admission, Team Admin season roles, first-admin bootstrap, and an admin recovery command. Admission called Discord's guild-member API with `DISCORD_ADMISSION_BOT_TOKEN`, so disabling the interactive bot did not eliminate dependence on a bot credential. PR 1 migrates admission to the linked user's OAuth token. The portal has season and roster management but no installation settings page. The existing facility display and `/signin` and `/signout` Discord commands remain as they are until the later portal attendance work.

## Decisions and behavior

### OAuth membership admission

Keep Discord OAuth as the current sign-in method and `DISCORD_GUILD_ID` as the configured admission guild. Request the minimum Discord user OAuth scope needed to check the signing-in user's membership in that guild; prefer the direct guild-member scope and endpoint if they work with the installed provider and application configuration. Verify membership with the user's OAuth access token before a new user/account is created, an account is linked, or a returning session is issued. Preserve the existing suspended-account check and distinguish a known nonmember from a Discord failure. A denied or uncertain check fails closed with a clear message.

The season self-joining path currently rechecks admission when an already-authenticated session crosses into a new season. Preserve that behavior using the linked Discord account's user OAuth token, refreshing it server-side when necessary. If that authorization has expired, been revoked, lacks the required scope, or cannot be refreshed or checked, do not enroll the user into the new season on an uncertain result. The builder must verify the exact Better Auth 1.7 integration points and handle existing accounts that granted the previous scopes, including a clear path to reauthorize. The API must no longer require `DISCORD_ADMISSION_BOT_TOKEN` once the migration is complete. OAuth client credentials remain deployment settings.

Discord documents a user OAuth scope for reading the current user's membership in a specific guild, and Better Auth documents extra provider scopes and a `getUserInfo` hook that receives the access token. These establish a plausible path; exact callback behavior in the installed version must be proven during planning/implementation. References: [Discord OAuth2 scopes](https://discord.com/developers/docs/topics/oauth2), [Better Auth OAuth provider options](https://better-auth.com/docs/concepts/oauth).

### Bot runtime and configuration

Keep the interactive bot in the API deployment for this stack. Isolate its connection and command registration behind a lifecycle component that can connect, disconnect, and reconnect without restarting Nest's HTTP server. A portal switch changes the desired enabled state; the runtime reports the observed state separately. Disabling closes the Discord gateway and stops handling new commands promptly. In-flight interactions may finish gracefully. Enabling without a token is rejected. An invalid token leaves the saved desired setting on but reports a failed connection; it never takes down the API. The runtime should recover from ordinary Discord disconnects according to the library's reconnect behavior, without changing the administrator's desired state.

The desired enabled state and encrypted interactive bot token persist across API restarts. A fresh installation starts disabled; later starts apply the last saved setting. Saving or replacing a token does not itself change that setting. Replacing a token while enabled reconnects with the new value; if reconnection fails, show the failure and do not disclose the token. The exact state table, connection manager, and response shapes are builder choices. Avoid coupling business services to a live Discord client; command adapters should continue to call shared application services. Keep development-guild command registration configurable through `DISCORD_DEVELOPMENT_GUILD_ID` in development; production registration behavior must be documented and must not depend on a development guild ID.

The portal token is write-only. Encrypt it at rest with a deployment-held key separate from the database, so a database dump alone does not reveal the token. The key is an installation secret supplied outside the portal; its exact name and encryption format are builder choices. Document backup and key-loss consequences. The token must not be rendered to a browser after saving. The initial implementation can remove pre-release `DISCORD_TOKEN` configuration once portal storage is in place, rather than maintaining two conflicting sources of truth.

### Team Admin control

Use Basecamp's existing effective `team_admin` season-role authorization, including its current/previous-season behavior and suspended-account rule. Do not grant access based on Better Auth's global `user.role`, merely being signed in, or a client-side visibility check. Protect read and write API routes server-side. Nonadmins cannot read bot status or change settings. On a fresh installation, the existing first-admin bootstrap through season creation remains the path to this setting; no new public bootstrap path is added.

The Team Admin portal surface shows the bot's desired setting and observed connection state, whether a token is configured, an action to replace it, and a switch to enable/disable the bot. It must communicate failures without echoing Discord credentials. Changes should be idempotent and avoid duplicate bot connections if two administrators act close together. The builder may settle the exact page location and UI wording.

Use the dashboard's configured shadcn component library for portal primitives. Install any missing switch, input, label, or similar primitive through shadcn instead of hand-building a replacement.

### Deployment and local development

The API and dashboard remain available with the bot disabled. Local startup through `pnpm dev` should work without an interactive bot token. Document the required environment settings, encryption-key backup, and restart behavior for the existing API deployment.

## PR boundaries

1. **OAuth admission:** replace bot-token membership checks at sign-in and season self-joining, migrate configuration and docs, and prove admitted/nonmember/unavailable behavior. Portal and bot runtime otherwise remain as they are.
2. **Controllable bot runtime:** isolate bot startup from HTTP startup; default a new installation to off, restore its saved setting on later starts, persist desired state and encrypted token, and expose narrow server-side settings and observed status guarded by Team Admin authorization. The exact division of API and UI work between PRs 2 and 3 may be adjusted for reviewability.
3. **Admin portal:** add the token and switch interface, surface live/failed states, and update the relevant configuration documentation. Remove obsolete interactive-bot environment settings after their replacement is usable.

Tests should cover the authorization boundary, OAuth admission and failure behavior, fresh-install default-off and saved-setting restoration after restart, connect/disconnect/reconnect behavior, token non-disclosure, and HTTP availability when Discord fails. The implementation plan can choose specific tests and sequence within these boundaries.

## What the builder may decide

The builder may choose table names, API shapes, connection manager structure, encryption primitive and key name, UI page layout, and the exact number of commits within each PR. They should verify the installed library hooks and use the existing Team Admin and database conventions. Any change to the user-visible admission rule, fresh-install default, saved-setting restoration, live switch, or PR scope needs renewed design agreement.
