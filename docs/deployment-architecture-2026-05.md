# nritax.ai Deployment Architecture

## Deployment architecture

- API traffic is served by an Argo Rollouts canary rollout with separate stable and canary services.
- Stateless API pods scale horizontally behind the rollout using CPU-based HPA and readiness probes against `/readyz`.
- BullMQ workers scale independently from API pods so queue spikes do not consume API capacity.
- GPU-bound AI workloads are isolated into a dedicated `nritax-gpu-worker` deployment with node selectors and GPU tolerations. The default replica count is `0` until a GPU queue path is actively enabled.
- Staging and production run from Kustomize overlays so region, replica count, and secrets can diverge without editing the base manifests.

## Infra scaling recommendations

- Keep API and worker fleets separate from day one. API scale should follow request latency; worker scale should follow queue depth and wait time.
- Use multi-region active-passive first, not active-active. Replicate stateless API services into a second region, keep Redis and Mongo failover documented, and fail over the DNS or global load balancer only after readiness probes pass.
- Treat Redis as a managed regional dependency with persistence and backups. Queue durability matters more than minimal latency for payment and report jobs.
- Move AI-heavy generation and embedding work behind queue feature flags before enabling GPU workers. This keeps the synchronous API fleet CPU-only and cheaper to autoscale.
- Add CDN or edge caching only for static assets and idempotent GET routes. Do not cache authenticated financial responses at the edge.

## Low-risk phased rollout

1. Release observability first with queues still mostly inline.
2. Turn on BullMQ paths one queue at a time: notifications, PDF, payment recovery, then AI/report jobs.
3. Deploy staging canaries with Grafana and Sentry checks before promoting production.
4. Enable the GPU worker only after AI queue demand is proven and routing is isolated.
5. Keep rollback simple: Argo undo for API, deployment rollback for workers, and feature-flag disablement for background paths.
