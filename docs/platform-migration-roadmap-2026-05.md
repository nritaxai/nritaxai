# nritax.ai Platform Modernization Roadmap

## Objectives

- Modernize the platform in controlled phases without breaking existing production behavior.
- Keep the current API contracts stable while new subsystems run in parallel.
- Use feature flags, staged traffic, canary deployments, and rollback-first operations.
- Prefer behavioral rollback over schema rollback.

## Current baseline

- Single Express API remains the system of record for production traffic.
- JWT auth, Razorpay payment verification, and current client flows remain unchanged.
- AI gateway, payment reliability, queue scaffolding, observability, and worker deployment assets already exist in repo.
- Kubernetes canary rollout and worker HPA assets exist, but should be adopted gradually behind environment gating.

## Rollout principles

1. Dark launch before cutover.
2. One variable at a time: feature, workload, traffic slice, then region.
3. Keep synchronous fallback paths alive until a phase is proven stable.
4. Roll back behavior first with flags, then deployments, then traffic.
5. Do not delete legacy paths during the same phase that introduces replacements.

## Phase 1: Stabilize and instrument

### Scope

- Monitoring
- Logging
- Caching
- AI gateway introduction
- Payment reliability fixes

### Goal

Make current production observable, measurable, and safer before changing execution topology.

### Deliverables

- Prometheus/Grafana/Sentry/OpenTelemetry enabled in staging, then production.
- Structured logging and security audit logging enabled.
- AI gateway enabled behind existing `/api/chat` contract.
- AI gateway response cache and hybrid retrieval cache enabled in read-through mode.
- Payment reliability audit ledger, idempotent verification, and webhook dedupe enabled.

### Runtime mode

- Existing API routes remain authoritative.
- New capabilities operate as wrappers around existing logic, not replacements.
- No queue cutover is required in Phase 1.

### Feature flags

- `STRUCTURED_LOGGING_ENABLED=true`
- `PROMETHEUS_METRICS_ENABLED=true`
- `SENTRY_ENABLED=true`
- `OTEL_ENABLED=false` initially, then `true` after collector validation
- `AI_GATEWAY_ENABLED=false` in dark launch, then `true` for internal/staging
- `AI_GATEWAY_CACHE_ENABLED=true`
- `PAYMENT_RELIABILITY_ENABLED=true`
- `PAYMENT_MONITORING_ENABLED=true`
- `PAYMENT_RECONCILIATION_ENABLED=true`
- `BACKGROUND_JOBS_ENABLED=false`

### Traffic plan

1. Staging only
2. Internal production verification
3. 5% canary
4. 25% canary
5. 100% production

### Exit criteria

- API error rate unchanged or better
- AI p95 latency within 10% of baseline or improved
- Cache hit rate measurable and stable
- Payment success rate unchanged or better
- No webhook duplication regression

## Phase 2: Parallel execution architecture

### Scope

- Queue-worker architecture
- AI routing system
- Optimized RAG pipeline
- Streaming AI responses

### Goal

Move expensive and variable-latency work off the synchronous request path while preserving current API behavior.

### Deliverables

- BullMQ workers actively process selected workloads.
- AI routing system chooses small/medium/large models by request tier.
- RAG retrieval upgraded from controller-coupled file scanning toward indexed retrieval pipeline.
- Streaming responses exposed via dedicated or negotiated API path with JSON fallback retained.

### Runtime mode

- API remains the single ingress layer.
- Workers run beside API, not instead of API.
- Inline handlers remain available for every newly queued workload.

### Cutover order

1. Consultation notifications
2. PDF indexing / reindexing
3. Payment reconciliation retries
4. AI embedding jobs
5. Report generation
6. Streaming AI responses

### Feature flags

- `BACKGROUND_JOBS_ENABLED=true`
- `CONSULTATION_QUEUE_ENABLED=true`
- `PDF_QUEUE_ENABLED=true`
- `PAYMENT_QUEUE_ENABLED=true`
- `AI_QUEUE_ENABLED=false` initially
- `REPORT_QUEUE_ENABLED=false` initially
- `AI_GATEWAY_ENABLE_PARALLEL_FALLBACK=true` only after route validation
- `AI_GATEWAY_STREAMING_ENABLED=false` initially, then staged to `true`
- `HYBRID_RETRIEVAL_CACHE_ENABLED=true`

### Parallel system support

- Inline controller behavior remains the rollback path.
- Old non-streaming client behavior remains supported.
- Legacy RAG path remains available while indexed retrieval is validated.

### Exit criteria

- Queue wait p95 below threshold
- Worker failure rate below threshold
- Streaming path error rate below non-streaming baseline
- RAG answer quality equal or better on evaluation cases

## Phase 3: Scale and optimize

### Scope

- Infra scaling
- Worker autoscaling
- Private LLM integration
- Advanced optimization

### Goal

Separate scaling concerns, reduce marginal AI cost, and prepare for higher concurrency and regional resilience.

### Deliverables

- API and worker fleets scale independently.
- Queue depth and wait time drive worker autoscaling decisions.
- GPU-isolated private LLM workload enabled only for explicitly routed tasks.
- Region-aware deployment and failover playbooks are validated.

### Runtime mode

- Public APIs remain unchanged.
- New private LLM path is additive and routed only for selected workloads.
- Existing third-party AI providers remain available as fallback.

### Feature flags

- `AI_GATEWAY_OLLAMA_ENABLED=true` only for approved routes
- `AI_QUEUE_ENABLED=true`
- `REPORT_QUEUE_ENABLED=true`
- `AI_GATEWAY_STREAMING_ENABLED=true`
- Region / GPU rollout stays behind deployment overlays, not just app flags

### Exit criteria

- API saturation no longer correlates with worker backlog
- Private LLM success and latency meet route-specific targets
- Cost/request and latency/request improve versus Phase 2 baselines

## Traffic progression model

For each major capability:

1. `off`
2. `dark_launch`
3. `internal_only`
4. `staging`
5. `production_5_percent`
6. `production_25_percent`
7. `production_50_percent`
8. `production_100_percent`

Use environment-specific flags or deployment overlays to implement these slices.

## Migration checkpoints

- Technical readiness: code deployed, flags off, health and metrics green
- Functional readiness: smoke tests and contract checks pass
- Comparative readiness: baseline versus candidate metrics reviewed
- Operational readiness: rollback owner, playbook, and alert thresholds confirmed

## Success metrics during migration

- API success rate
- Chat p50 / p95 latency
- AI provider latency and route-tier distribution
- Queue depth / queue wait p95
- Payment success rate
- Payment webhook lag
- Cache hit rate
- RAG retrieval precision / grounding score
- Worker failure rate
- Cost per AI request
