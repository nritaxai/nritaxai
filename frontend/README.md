# Frontend Module

This module is the monorepo-facing entrypoint for the web and mobile UI.

## Current runtime source

- Active implementation: `../client`
- Migration approach: move feature areas into `frontend/src` incrementally while keeping `client/` operational

## Target boundaries

- UI composition
- route-level state
- platform adapters
- frontend-only services
- no direct backend internals
