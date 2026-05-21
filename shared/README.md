# Shared Module

This module holds cross-cutting contracts, portable utilities, and configuration helpers.

## Responsibilities

- shared types
- API contracts
- environment parsing helpers
- stable config primitives
- frontend/backend-safe utilities

## Dependency rule

- Shared must not import backend or frontend feature code.
- Shared may be imported by every other module.
