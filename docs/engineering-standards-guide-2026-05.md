# Engineering Standards Guide

## Purpose

These standards are intended to reduce technical debt incrementally while keeping production behavior stable.

## Refactoring Rules

- Prefer additive extraction over rewrites.
- Preserve route contracts, payload shapes, and feature flags unless a migration plan exists.
- Break large files by concern, not by arbitrary line count.
- If a refactor changes behavior, gate it behind a flag or roll it out in stages.

## Backend Standards

### Controllers

- Controllers should focus on:
  - request validation
  - calling services
  - returning responses
- Move business logic into `services/`.
- Use shared response helpers for common success/error shapes.
- Use structured logging via `server/services/logger.js` rather than `console.error`.

### Services

- Keep service modules single-purpose.
- Name services by business concern, not implementation detail.
- Prefer pure helpers when no I/O is required.

### Error Handling

- Log once at the controller or boundary layer unless lower-level context is essential.
- Return stable error payloads.
- Preserve legacy response keys when routes are already consumed by production clients.

## Frontend Standards

### Components

- Keep presentational components separate from stateful workflow containers when practical.
- Extract shared domain logic into feature modules before duplicating it in two components.
- Avoid mixing transport, local storage, and rendering logic in one component if the file is already large.

### API Access

- Prefer centralized API helpers over ad hoc request code.
- Prefer typed request and response payloads for app-critical flows.
- Be intentional about `fetch` vs `axios`; do not mix both in the same feature unless there is a clear reason.

### TypeScript

- Prefer `type` imports where possible.
- Avoid `any`; if unavoidable, keep it local and document why.
- Export shared domain types from feature modules when multiple files use them.

## Naming Standards

- Use `camelCase` for functions and variables.
- Use `PascalCase` for React components and Mongoose models.
- Use descriptive feature names for shared modules such as `chat/shared.ts` instead of generic `helpers.ts` when the domain is known.

## Testing Standards

- Add tests for extracted pure helpers and boundary utilities first.
- When large controllers are split, add tests around the extracted business logic before changing route behavior.
- Prefer focused tests for:
  - response helpers
  - normalization logic
  - mapping functions
  - validation helpers

## File Size Guidance

- Treat files above roughly 500 lines as review candidates.
- Treat files above roughly 1000 lines as refactor candidates unless they are mostly static data.
- Large files should justify why they remain large.

## Rollout Safety

- For production-sensitive areas such as auth, payments, chat, and document processing:
  - preserve backward compatibility
  - refactor behind existing interfaces
  - validate logs, metrics, and error rates after rollout
