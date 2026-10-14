# Basecamp dashboard

Run locally with `pnpm --filter web dev`. Set `API_INTERNAL_URL` in `apps/dashboard/.env.local` to the Nest API origin (defaults to `http://localhost:8000`). Next proxies `/api/auth/*` and `/api/attendance-display/*` to that origin, keeping display cookies on the dashboard origin.

Open `/attendance/display` on a device at the facility. A mentor unlocks it with `ATTENDANCE_DISPLAY_PASSWORD` configured in the API environment. The page then shows a four-digit code for `/signin` and `/signout` in Discord. It generates each new code locally every 30 seconds, clears the seed on logout or when its 12-hour session expires, and does not store the seed in local storage. The browser and API clocks should be reasonably synchronized. See [the API setup](../api/README.md#facility-attendance-display) for environment variables and rate limits.
