# nritax.ai Migration Dependency Map

## Phase dependency graph

### Phase 1 depends on

- Existing API stability
- Sentry / metrics / dashboards
- Feature flag discipline
- Payment audit persistence

### Phase 2 depends on

- Phase 1 observability and alerting
- Redis availability and worker health checks
- Inline fallback handlers preserved
- AI gateway metrics for routing comparison

### Phase 3 depends on

- Phase 2 queue and worker stability
- Worker autoscaling metrics
- Region-aware deployment overlays
- Proven rollback workflows for API and workers

## Capability dependency mapping

| Capability | Depends On | Rollback Path |
|---|---|---|
| Monitoring | API metrics endpoint, dashboards, alerting | Disable sinks, keep app running |
| AI gateway | Metrics, validation, provider fallback | `AI_GATEWAY_ENABLED=false` |
| Payment reliability | Audit models, webhook validation | keep endpoint logic, disable reliability behaviors |
| Queue workers | Redis, worker runtime, inline handlers | disable queue flags, fall back inline |
| AI routing | AI gateway, route classification metrics | route all traffic to legacy/default model |
| Optimized RAG | retrieval evaluation, cache, indexing jobs | revert to legacy filesystem retrieval |
| Streaming AI | client fallback support, gateway readiness | disable streaming flag, use JSON |
| Worker autoscaling | queue depth metrics, HPA, worker health | pin replicas and disable HPA |
| Private LLM | isolated GPU worker, route gating, fallback model | disable private-LLM flag and route to hosted models |

## Shared dependencies that must not change mid-phase

- JWT auth contract
- Existing REST route shapes
- Razorpay order verification semantics
- MongoDB schemas already in production use
- Client token handling behavior
