# Basecamp

Basecamp is a self-hosted web platform for FRC teams. Each installation serves one team, and that team hosts and owns its data; YETI is the first installation. The dashboard and API support season-based roster management and team operations, alongside Discord attendance workflows.

Read the [domain context](CONTEXT.md), [architecture decisions](docs/adr/README.md), and the [seasons and self-joining roster design](docs/superpowers/specs/2026-10-15-seasons-and-self-joining-roster-design.md) for the product language and boundaries.

The project is built as a Turborepo monorepo to share code, tooling, and types across multiple applications and packages.

---

## Tech Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

### Backend
- NestJS
- TypeScript
- REST API

### Database
- PostgreSQL


### Tooling
- Turborepo
- pnpm Workspaces
- biome.js

---

## Repository Structure

```text
apps/
├── dashboard/      # Next.js web dashboard
└── api/            # NestJS API for auth, seasons, roster, attendance, and Discord workflows

packages/
├── attendance-code/    # Shared attendance code generation and validation
├── ui/                 # Shared UI components
└── typescript-config/  # Shared TypeScript configuration
```

---

## Getting Started

### Prerequisites

- Node.js 20.19+
- pnpm 12.10.0

Install dependencies:

```bash
pnpm install
```

Start all development servers:

```bash
pnpm dev
```

Build every application and package:

```bash
pnpm build
```

Run linting:

```bash
pnpm lint or using biome run lint
```

Format the repository:

```bash
pnpm format
```

---

## Development

This repository uses **Turborepo** to orchestrate builds, development servers, and caching across applications and shared packages.

The workspace contains a Next.js dashboard and NestJS API. Local PostgreSQL is defined in `docker-compose.yaml`. For development in Codex-managed Git worktrees, see [the worktree guide](docs/development/worktrees.md).

---


---

## Contributing

1. Create a feature branch.
2. Make your changes.
3. Open a pull request.
4. Ensure linting and builds pass before merging.

---

## License

Private repository. All rights reserved.
