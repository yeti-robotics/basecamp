# Local Discord bot setup

The web dashboard and API run without the interactive Discord bot. Use this guide when you want to test slash commands in a development server. Use a test Discord application, guild, and fictional Basecamp accounts; do not put production credentials in a local worktree.

## 1. Configure Discord OAuth admission

1. Create a Discord application in the [Discord Developer Portal](https://discord.com/developers/applications). Copy its **Application ID** and OAuth **Client Secret** into `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in `apps/api/.env.local`.
2. Add `http://localhost:3000/api/auth/callback/discord` as an OAuth redirect URL for the default local dashboard port. If your worktree uses another dashboard port, use that port in the redirect URL and `BETTER_AUTH_URL`.
3. Put the test server's ID in `DISCORD_GUILD_ID`. This is the admission server: users must belong to it to sign in. Basecamp requests `identify`, `email`, and `guilds.members.read` from each user. Existing users may need to reconnect Discord to grant the membership scope.

Discord OAuth admission uses the person's OAuth grant. It does not require the interactive bot or its token. Set the other required API values from `apps/api/.env.example`, including a local PostgreSQL connection and attendance display secrets. Set `API_INTERNAL_URL` in `apps/dashboard/.env.local` to the local API URL. Start both apps with `pnpm dev` from the repository root.

## 2. Install the interactive bot

1. In the same Discord application, create a bot and copy its token. Keep the token private; Basecamp stores it encrypted after you save it in the dashboard.
2. Generate `BOT_SETTINGS_ENCRYPTION_KEY` with `openssl rand -base64 32`, add it to `apps/api/.env.local`, and restart the API. Keep a separate backup of the key; losing it makes the saved token unreadable.
3. In the Developer Portal's installation settings, allow server installation with the `bot` and `applications.commands` scopes. Invite the bot to the **test server**. Give it only the permissions needed for the commands you are testing; Discord Administrator is unnecessary.
4. Set `DISCORD_DEVELOPMENT_GUILD_ID` in `apps/api/.env.local` to that test server's ID, then restart the API. This setting directs Necord's slash-command registration to that guild. It can match `DISCORD_GUILD_ID`; if the IDs differ, users still need admission to the configured admission guild.
5. Sign in as a local Team Admin, open **Settings → Discord bot**, save the token, and enable the bot. A new installation starts with the bot disabled. Saving a token alone does not connect it. The enabled setting and status message persist across API restarts.

Use a 17–20 digit Discord server ID copied with Developer Mode's **Copy Server ID** action. Do not use the application ID, bot user ID, or a channel ID. Test that the bot appears in the selected server before enabling it. After successful registration, check that commands appear in the server and try a command with a fictional member.

## Troubleshooting

The Settings page reports a safe failure message and offers **Retry connection**. It never shows the saved token.

| Message | Check |
| --- | --- |
| Could not register commands in the development guild | Confirm `DISCORD_DEVELOPMENT_GUILD_ID` is the server where this application is installed. Reinstall with `applications.commands` if needed. Confirm the bot can access that server. `DiscordAPIError[50001]: Missing Access` is commonly a guild ID or installation access problem, even when token login succeeds. |
| Discord rejected the saved bot token | Replace the token in Settings. A revoked token cannot be reused. |
| Discord could not be reached | Check local connectivity and retry later. The API and dashboard remain available while the bot is disconnected. |
| Discord is rate limiting the bot | Wait before retrying. Avoid repeatedly toggling the bot during a rate limit. |
| Saved token could not be decrypted | Restore the original `BOT_SETTINGS_ENCRYPTION_KEY` or save a new bot token with the new key. |

The bot uses Discord's own reconnect behavior for ordinary gateway disconnects. If command registration or the client reports an error, Basecamp closes that bot context and leaves the HTTP API running. A Team Admin can retry from Settings. Turning the bot off closes its context; no API restart is needed.
