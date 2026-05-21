# nritax.ai Modular Repo Migration Strategy

## Why this approach

- The repository already contains live production code paths in `client/` and `server/`.
- A direct rename or large file move would create unnecessary deployment and merge risk.
- The safer migration is to create the target architecture around the current runtime, then migrate inward gradually.

## Migration phases

### Phase A: Workspace shell

- Add root workspace tooling
- Add top-level architectural modules
- Add shared contracts and config helpers
- Keep all production runtime entrypoints unchanged

### Phase B: Shared extraction

- Move reusable config, contracts, and portable utilities into `shared/`
- Update backend/frontend code to consume `shared/` exports
- Preserve existing import paths with compatibility re-exports where needed

### Phase C: Domain extraction

- Separate backend bounded contexts:
  - auth
  - chat
  - payments
  - consultations
  - ai orchestration
- Move worker-specific logic behind `workers/` package boundaries

### Phase D: Runtime cutover

- Flip build/dev entrypoints from `client/` and `server/` to `frontend/` and `backend/`
- Remove compatibility wrappers only after smoke tests and rollout validation pass

## Rollback strategy

- If a module migration causes issues, revert the import path to the legacy runtime folder
- Keep wrapper packages and legacy directories in parallel until post-cutover stabilization
- Do not delete legacy directories in the same release that introduces a new module runtime
