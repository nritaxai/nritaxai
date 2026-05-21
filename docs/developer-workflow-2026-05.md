# nritax.ai Developer Workflow Improvements

## Monorepo tooling

- Root `package.json` now provides shared workspace scripts:
  - `npm run setup`
  - `npm run dev`
  - `npm run test`
- Module wrappers provide stable entrypoints for future package-level tooling.

## Local development

- `npm run dev` starts frontend and backend together
- `START_WORKER=true npm run dev` also starts workers
- Existing package-level workflows remain intact:
  - `npm --prefix client run dev`
  - `npm --prefix server run dev`

## Shared testing setup

- Root test entrypoint runs the server suite in the known-safe in-process mode
- Additional module-level tests can be added later without changing the top-level workflow

## Shared linting direction

- Frontend keeps its existing lint configuration during migration
- Backend/shared linting should be added after module extraction settles
- The repo now has a single root lint entrypoint so teams can converge on one workflow incrementally

## Setup automation

- `scripts/setup-workspace.mjs`
- `scripts/dev-workspace.mjs`
- `scripts/test-workspace.mjs`
- `scripts/lint-workspace.mjs`

## Build optimization direction

- Keep current frontend build path stable
- Centralize shared contracts/config first
- Add package-aware caching only after runtime cutover to avoid churn during the transition
