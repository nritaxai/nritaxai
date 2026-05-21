# nritax.ai Enterprise Infra Readiness Plan

## Purpose

This plan translates the enterprise architecture roadmap into deployment, benchmark, and capacity actions that can be adopted incrementally while existing production systems remain operational.

## Readiness Scorecard

| Capability | Current State | Near-Term Target | Readiness |
| --- | --- | --- | --- |
| API horizontal scaling | API HPA exists | tune by latency + CPU guardrails | Partial |
| Worker autoscaling | CPU-based HPA exists | queue wait and depth aware scaling | Partial |
| Multi-region | overlays and region tags exist | active-passive warm standby | Partial |
| Tenant context | additive code scaffolding added | route and data-path enforcement | Early |
| RBAC | additive code scaffolding added | admin route enforcement | Early |
| Audit logging | security and payment audit exist | tenant-aware enterprise audit queries | Partial |
| DR readiness | probes and rollback patterns exist | documented RPO/RTO drills | Early |
| AI orchestration | gateway and route telemetry exist | workflow registry and chaining | Partial |

## Scalability Strategy

### API fleet

- Keep the API fleet stateless and horizontally scalable.
- Preserve the current single API surface for all clients.
- Scale API replicas from latency-sensitive signals first, CPU second.
- Protect readiness during downstream stalls by keeping provider and queue failures from blocking `/readyz`.

### Worker fleet

- Split workers by workload class as traffic grows:
  - `general-worker`
  - `payment-worker`
  - `ai-worker`
  - `gpu-worker`
- Keep payment and reconciliation workloads isolated from AI-heavy workloads.
- Introduce queue concurrency caps per job family.

### Regional strategy

- Use single-region primary with warm secondary region first.
- Promote only stateless API paths to regional failover readiness first.
- Treat Redis and Mongo failover as operational, not only architectural, work.

## Benchmark Targets

### API benchmarks

- `GET /health`, `GET /readyz`: 99.9% success under load
- authenticated non-AI routes: p95 under 800ms
- chat routes with hosted AI: p95 under 4s
- error rate during canary: under 1%

### Queue benchmarks

- payment queue wait p95: under 60s
- consultation queue wait p95: under 30s
- PDF queue wait p95: under 5m
- AI async queue wait p95: under 90s

### Recovery benchmarks

- API failover validation: under 30 minutes
- worker fleet recovery: under 60 minutes
- payment reconciliation recovery: under 15 minutes to catch up backlog
- audit log restore verification: completed quarterly

## Capacity Planning Model

### Inputs

- peak concurrent users
- peak concurrent chat sessions
- average and p95 tokens per AI request
- queue arrival rate per job type
- average worker duration and retry rates
- enterprise tenant count and projected seat growth
- region-specific traffic split assumptions

### Planning formula

Plan each class independently:

- API: `peak_rps x p95_handler_time x safety_factor`
- Worker: `queue_arrivals_per_minute x avg_job_seconds / target_queue_slo`
- AI: `peak_requests x avg_tokens x route_mix`

### Safety margins

- API replicas: 30-40% headroom
- worker throughput: 50% burst headroom for payment and AI lanes
- Redis memory: 2x expected working set for queues + caches
- Mongo capacity: baseline traffic plus 2x audit growth allowance

## Low-Risk Adoption Sequence

1. Deploy tenant-aware request and audit context with enforcement off.
2. Add queue dashboards and alerts for wait p95, failed jobs, and retry storms.
3. Tune current API and worker HPA thresholds in staging from observed metrics.
4. Add dedicated AI and payment worker pools before increasing concurrency aggressively.
5. Rehearse secondary-region failover before signing enterprise SLOs.

## Reliability Improvement Plan

### Graceful degradation

- keep sync fallbacks for newly queued workloads
- prefer cached or safe fallback AI responses when providers time out
- degrade analytics and non-critical reporting before core user workflows

### Failure isolation

- isolate queues by workload criticality
- isolate GPU workers from default worker pools
- avoid shared scaling policies across API, payment, and AI workers

### Disaster recovery

- define RPO/RTO per subsystem
- document failover owners and runbooks
- run restore drills for Mongo and Redis snapshots
- verify audit log and payment reconciliation recovery paths quarterly

## Concrete Next Steps

1. Replace the worker CPU-only HPA strategy with queue-backed custom metrics.
2. Add dedicated dashboards for payment queue wait, AI queue wait, and worker retry rates.
3. Create a tenant and permission matrix for future admin and enterprise routes.
4. Write failover and restore runbooks with exact owners and rehearsal dates.
5. Introduce workflow definitions for future multi-agent AI execution.
