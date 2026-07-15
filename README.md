# Basecamp

Basecamp is the web platform for managing and interacting with the Yeti Robotics offical Discord bot. It replaces Discord-only commands with a modern dashboard, providing administrators, mentors, students, and team members with an intuitive interface to manage robotics team data and update students attendance hours, outreach hours, and other things within its reach.

The project is built as a Turborepo monorepo to share code, tooling, and types across multiple applications and packages.

---

## Tech Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

### Backend *(coming soon)*
- NestJS
- TypeScript
- REST API

### Database *(coming soon)*
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
└── api/            # NestJS backend (planned) to work as middle man from discord bot to the dashboards incoming requests 

packages/
├── ui/             # Shared UI components
|-> shared biome configuration
└── typescript-config/ # Shared TypeScript configuration
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+

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

As the project grows, additional services such as the NestJS API and PostgreSQL database will integrate seamlessly into the existing workspace.

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