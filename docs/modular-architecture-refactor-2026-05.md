# nritax.ai Modular Architecture Refactor

## Refactored repo structure

```text
frontend/        monorepo-facing frontend module
backend/         monorepo-facing backend module
ai-gateway/      isolated AI routing and provider module
workers/         async execution module
shared/          contracts, shared config, shared utilities, shared types
infrastructure/  deployment and platform assets
monitoring/      observability assets and guidance

client/          legacy runtime frontend source (still operational)
server/          legacy runtime backend source (still operational)
infra/           legacy infra asset location (still operational)
```

## Incremental restructuring strategy

- Step 1: introduce top-level modular packages and shared workspace tooling
- Step 2: keep `client/` and `server/` as production runtime roots
- Step 3: move shared contracts and env parsing into `shared/`
- Step 4: migrate feature areas one bounded context at a time
- Step 5: only switch runtime roots after module parity is proven

## Dependency boundaries

- `frontend` may depend only on `shared`
- `backend` may depend on `shared` and `ai-gateway`
- `ai-gateway` may depend only on `shared`
- `workers` may depend on `shared`, `backend`, and `ai-gateway`
- `infrastructure` and `monitoring` remain configuration-only modules

## Clean architecture direction

- Domain logic gradually moves away from route/controller files
- Shared contracts define stable seams before code moves
- Service isolation is introduced by module boundaries first, then directory moves
- Compatibility wrappers prevent production breakage during migration
