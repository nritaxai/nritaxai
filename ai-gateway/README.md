# AI Gateway Module

This module isolates provider routing, fallback behavior, validation, caching, and streaming policy.

## Current runtime source

- Active implementation: `../server/services/aiGateway`

## Responsibilities

- provider selection
- route-tier classification
- fallback and retry policy
- AI response validation
- gateway metrics and cache policy

## Dependency rule

- The backend can call into the AI gateway.
- The AI gateway must not depend on route/controller code.
