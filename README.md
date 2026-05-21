# nritax.ai Monorepo

This repository is being incrementally refactored into a modular platform architecture without breaking the current production runtime.

## Active modules

- [frontend](./frontend/README.md)
- [backend](./backend/README.md)
- [ai-gateway](./ai-gateway/README.md)
- [workers](./workers/README.md)
- [shared](./shared/README.md)
- [infrastructure](./infrastructure/README.md)
- [monitoring](./monitoring/README.md)

## Current compatibility model

- The production frontend still runs from `client/`.
- The production backend and worker runtime still run from `server/`.
- The new top-level modules act as monorepo entrypoints, shared contracts, and migration targets.
- Refactoring is incremental: behavior stays in the stable codepaths until each domain is explicitly migrated.

## Quick start

```bash
npm run setup
npm run dev
```

## Architecture docs

- [Modular architecture plan](./docs/modular-architecture-refactor-2026-05.md)
- [Developer workflow guide](./docs/developer-workflow-2026-05.md)
- [Migration strategy](./docs/modular-repo-migration-strategy-2026-05.md)
- [Autoscaling architecture](./docs/autoscaling-architecture-2026-05.md)
- [AI streaming UX report](./docs/ai-streaming-ux-report-2026-05.md)
