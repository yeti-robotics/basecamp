# Developing in Codex worktrees

## First-time setup

Install Node.js 20.19 or newer and pnpm 12.10.0 (the version in the root `package.json`). Configure the API and dashboard environment files in the primary checkout: `apps/api/.env.local` and `apps/dashboard/.env.local`. The API also accepts `apps/api/.env`; use that if it is your existing local file. See the app `.env.example` files and [API setup](../../apps/api/README.md) for required keys. Keep these files ignored by Git. Use an existing PostgreSQL server or start the repository's single local service with `docker compose up -d postgres`.

In the Codex desktop app, open this repository as a project, select **Codex**, then open the project's **Local Environment** settings. Set the setup script to:

```bash
./scripts/setup-worktree.sh
```

Codex generates its Local Environment configuration in the root `.codex` folder. This repository ignores that folder, so each developer configures the setting once in the app. Do not assume that adding a script to the repository registers it automatically. [Codex Local Environments documentation](https://developers.openai.com/codex/app/local-environments)

## Creating and using a worktree

Create a Codex-managed worktree for this project. Codex copies the ignored files listed in `.worktreeinclude` from the primary checkout at creation time and runs the configured setup script. The script installs dependencies with the existing lockfile. It does not create or migrate a database.

From the new worktree, start both apps with their default ports:

```bash
pnpm dev
```

The dashboard is at `http://localhost:3000`; the API defaults to `http://localhost:8000`. Run checks from the worktree root:

```bash
pnpm test
pnpm check-types
```

## Running multiple worktrees

Choose two free ports for an additional worktree. In that worktree, set `PORT` and `BETTER_AUTH_URL` in `apps/api/.env.local`, and set `API_INTERNAL_URL` in `apps/dashboard/.env.local`. For example, choose API 8001 and dashboard 3001, then set `PORT=8001`, `BETTER_AUTH_URL=http://localhost:3001`, and `API_INTERNAL_URL=http://localhost:8001`. Check any OAuth callback configuration you use for the new dashboard port.

Start each app in a separate terminal:

```bash
pnpm --filter api dev
PORT=3001 pnpm --filter web dev
```

Next.js reads its listening port from the shell's `PORT`; setting it in the dashboard `.env.local` does not set the server port. The API reads its `PORT` from `apps/api/.env.local`. Keep the dashboard's `API_INTERNAL_URL` aligned with the API port. The same `pnpm dev` command still starts both apps on their default ports when no alternate ports are configured.

The Docker Compose file defines one local Postgres service on port 5432 and one `basecamp` database. Existing worktrees can share it, but schema migrations, resets, and destructive data changes affect every worktree using that database. Do not run `db:nuke` against a shared database. If concurrent schema work requires isolation, create separate databases in the existing Postgres instance and point each worktree's `DATABASE_URL` to its own database. No database or container is created automatically for a worktree.

## Environment file behavior and troubleshooting

- Codex copies ignored environment files only when a managed worktree is created. Later edits in one checkout do not sync to others; edit each worktree's copies directly. Existing worktrees need their own manual copies. A Git worktree created from the command line does not use `.worktreeinclude`. [Codex worktree documentation](https://developers.openai.com/codex/app/worktrees)
- If environment validation fails, check that the worktree has the app `.env.local` files and that the required keys from the app examples are set. The setup script prints a file path notice when an app file is absent; it never prints values.
- If setup says pnpm is missing, install pnpm 12.10.0 locally and rerun `./scripts/setup-worktree.sh` from the worktree. If installation fails, resolve the reported dependency or network error and rerun the script. The lockfile is frozen.
- If a port is in use, select other free dashboard and API ports and update the three settings above. Do not stop a server belonging to another worktree.
- If the API cannot connect to Postgres, check that the existing Postgres service is running and that this worktree's `DATABASE_URL` points to the intended database. Do not reset another worktree's data.
