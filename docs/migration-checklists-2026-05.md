# nritax.ai Migration Checklists

## Pre-migration checklist

- Confirm current production baseline metrics for latency, errors, queue depth, and payments
- Confirm rollback owner and communications channel
- Confirm all new flags default to the legacy-safe behavior
- Confirm staging environment mirrors required dependencies
- Confirm dashboards and alerts are visible before feature enablement
- Confirm legacy inline path still passes smoke tests

## Phase 1 checklist

- Deploy code with all new behavioral flags off
- Validate `/health`, `/ready`, `/metrics`, Sentry, and logs
- Enable structured logging
- Enable metrics and tracing sinks
- Enable payment reliability in audit-first mode
- Enable AI gateway for internal/staging traffic
- Compare baseline versus candidate for API and chat latency

## Phase 2 checklist

- Confirm Redis and workers are healthy
- Turn on `BACKGROUND_JOBS_ENABLED` in staging only
- Enable one queue type at a time
- Verify dead-letter handling and retry behavior
- Validate AI routing decisions against sampled production-like prompts
- Validate streaming path with client fallback intact
- Compare queue-backed path versus inline path before wider rollout

## Phase 3 checklist

- Validate worker HPA against synthetic backlog
- Keep GPU worker replicas at zero until route gating is ready
- Route only approved workloads to private LLM path
- Confirm hosted-model fallback remains functional
- Validate canary in primary region before enabling secondary-region readiness
- Run failover simulation and worker recovery drill

## Go / no-go checklist for each promotion

- Error budget intact
- No P1/P0 incidents open
- Rollback command confirmed
- Alerts green for 30-60 minutes at current traffic slice
- Product owner and platform owner approve next slice
