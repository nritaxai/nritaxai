# Backend Module

This module represents the API boundary for the nritax.ai platform.

## Current runtime source

- Active implementation: `../server`
- Migration approach: introduce domain-aligned services and contracts first, then relocate by bounded context

## Target layers

- `domain/`: business rules and models
- `application/`: use cases and orchestration
- `interfaces/`: HTTP controllers, jobs, external adapters
- `infrastructure/`: persistence, telemetry, third-party integrations

## Dependency rule

- Inward dependencies only.
- Domain must not import HTTP, Express, or provider SDK specifics.
