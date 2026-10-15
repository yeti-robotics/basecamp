# Worktree development

- Codex-managed worktrees copy the ignored app environment files listed in `.worktreeinclude` when created. They are independent copies; do not commit them.
- In Codex Local Environments, set the worktree setup command to `./scripts/setup-worktree.sh`. This runs `pnpm install --frozen-lockfile`; never run migrations or database resets as part of setup.
- Run `pnpm dev` for the default API (8000) and dashboard (3000), or use the filtered commands and port settings in [the worktree guide](docs/development/worktrees.md) when another worktree is running.
- Run `pnpm test` and `pnpm check-types` from the repository root. Do not stop another worktree's servers or run destructive database commands against a shared database.
