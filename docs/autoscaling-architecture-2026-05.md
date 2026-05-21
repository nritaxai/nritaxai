# nritax.ai Autoscaling Architecture

## Objectives

- Scale API, AI, and background workers independently.
- Keep the current production behavior safe by default.
- Add queue-aware scaling signals before moving to aggressive queue-driven autoscaling.
- Preserve inline fallbacks and feature-flag rollback paths.

## Runtime Model

### API services

- `infra/k8s/base/api-rollout.yaml` keeps the API on Argo Rollouts with canary steps.
- HPA scales on both CPU and memory with conservative scale-down stabilization.
- Readiness and `preStop` hooks reduce disruption during regional failover and spike rollouts.

### Queue workers

- `server/workers/runtimeConfig.js` adds `WORKER_QUEUES`, `WORKER_GROUP`, and per-queue concurrency overrides such as `WORKER_CONCURRENCY__PAYMENT_JOBS=8`.
- If those env vars are absent, workers remain backward compatible and continue processing all queues.
- `infra/k8s/base/worker-deployment.yaml` remains the default mixed worker deployment.

### Isolated worker lanes

- `nritax-worker-priority`
  - queues: `payment-jobs`, `notification-jobs`
  - use for latency-sensitive background jobs
- `nritax-worker-batch`
  - queues: `pdf-jobs`, `report-jobs`
  - use for CPU and memory-heavy document work
- `nritax-worker-ai`
  - queue: `ai-jobs`
  - use for non-GPU AI orchestration
- `nritax-gpu-worker`
  - queue: `ai-jobs`
  - reserved for GPU-only inference paths

## Autoscaling Strategy

### Phase 1: safe production baseline

- API: HPA on CPU + memory.
- Mixed worker: HPA on CPU + memory.
- Queue depth, queue wait, and worker utilization are observed but not yet authoritative.

### Phase 2: isolated worker rollout

- Apply `infra/k8s/overlays/production-isolated-workers`.
- Reduce `nritax-worker` to a compatibility pool.
- Bring up dedicated `priority`, `batch`, and `ai` workers with queue filters.

### Phase 3: queue-driven autoscaling

- Install KEDA.
- Apply `infra/k8s/addons/keda`.
- Scale workers from queue pressure instead of CPU alone.

## Resource Allocation Strategy

### API

- requests: `250m-500m CPU`, `512Mi memory`
- limits: `1 CPU`, `1Gi memory`
- target: absorb traffic spikes without blocking on worker jobs

### Priority workers

- high concurrency
- lower memory per job
- ideal for payment reconciliation and notifications

### Batch workers

- lower concurrency
- higher memory headroom
- protect API and priority jobs from PDF/report bursts

### AI CPU workers

- moderate concurrency
- isolated memory budget
- keep orchestration and embedding loads away from standard queue traffic

### GPU workers

- concurrency `1`
- explicit `nvidia.com/gpu` request
- scale from zero until premium or heavy inference demand is confirmed

## Monitoring And Scaling Signals

### Metrics added

- `nritax_worker_concurrency_configured`
- `nritax_worker_jobs_active`
- `nritax_worker_utilization_ratio`
- existing queue depth, queue wait, AI latency, AI cost, cache, DB, and payment metrics

### Dashboards

- `infra/observability/grafana/nritax-platform-overview.json`
- `infra/observability/grafana/nritax-ai-cost-efficiency.json`
- `infra/observability/grafana/nritax-scaling-control-plane.json`

### Primary autoscaling signals

- API: CPU, memory, request latency
- Priority workers: queue depth, active jobs, payment error rate
- Batch workers: queue depth, queue wait P95, RSS memory
- AI workers: queue depth, AI latency, AI spend
- GPU workers: AI queue backlog plus explicit feature enablement

## Multi-Region Readiness

- Add `APP_REGION` in overlays so metrics and logs are region-aware.
- Run active-active API in at least two regions behind global routing.
- Keep Redis and Mongo as managed multi-AZ services before enabling cross-region write failover.
- Prefer region-local workers with queue ownership pinned by deployment overlay first.
- Fail over AI/GPU lanes separately from API if GPU capacity is region-constrained.

## Traffic Spike Handling

- Let API scale first and shed heavy work into Redis-backed queues.
- Keep default mixed workers during rollout as a safety buffer.
- Use `priority` workers for payment and notification SLOs.
- Hold `batch` workers behind queue flags during predictable PDF/report surges.
- Enable KEDA only after 7-14 days of stable queue telemetry.

## Disaster Recovery And HA

- API: canary rollout + PDB + readiness/liveness probes.
- Workers: PDBs and termination grace periods to reduce in-flight job loss.
- Queue durability: Redis persistence must stay enabled before queue-first rollout.
- Database: keep Mongo indexes and readiness checks in place; do not couple `/health` to app-side warmup.
- Recovery order:
  1. Restore Redis and Mongo connectivity.
  2. Bring API stable pool up.
  3. Bring priority workers up.
  4. Restore batch and AI lanes.
  5. Re-enable queue feature flags if they were disabled.

## Incremental Rollout Plan

1. Deploy runtime code and metrics changes with current `nritax-worker` only.
2. Validate dashboard signals and concurrency metrics in staging.
3. Deploy `production-isolated-workers` overlay with `priority` workers only.
4. Move payment and notification traffic behind isolated workers.
5. Add `batch` workers for PDF/report load.
6. Add `ai` workers, then GPU workers, only when async AI paths are live.
7. Install KEDA and shift to queue-driven autoscaling after metrics are stable.

## Rollback

- Scale isolated workers to `0`.
- Restore `nritax-worker` replicas to current baseline.
- Disable queue-specific flags if a lane introduces regressions.
- Leave API rollout unchanged so frontend contracts remain stable.
