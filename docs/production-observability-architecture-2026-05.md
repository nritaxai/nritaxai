# nritax.ai Production Observability Setup

## Monitoring architecture

- Application signals start in the Node API and worker runtimes with OpenTelemetry traces, structured JSON logs, Sentry exception reporting, and a Prometheus `/metrics` endpoint.
- The API now exports first-class metrics for HTTP latency, API failures, AI latency, cache hit rate, queue depth and wait time, DB latency, and payment outcomes.
- Queue depth is sampled from BullMQ on an interval so autoscaling and saturation alerts can use real backlog rather than request proxies.
- OpenTelemetry traces flow to an OTLP collector, then to a trace backend such as Grafana Tempo.
- Prometheus scrapes the API, worker, and collector targets and Grafana renders the dashboards in `infra/observability/grafana/nritax-platform-overview.json`.
- Sentry remains the fast path for regression and exception detection, while Prometheus/Grafana provide SLO visibility and rollout guardrails.

## Production-ready rollout

1. Deploy code with `PROMETHEUS_METRICS_ENABLED=true`, `OTEL_ENABLED=false`, and `SENTRY_ENABLED=true`.
2. Verify `/health`, `/ready`, `/readyz`, and `/metrics` on staging.
3. Enable `OTEL_ENABLED=true` only after the collector is reachable.
4. Wire Prometheus alerts to block production canary promotion if:
   - API failure rate exceeds 2% for 10 minutes
   - AI p95 latency exceeds 8 seconds for 10 minutes
   - payment success rate drops below 97% for 15 minutes
   - queue wait p95 exceeds 60 seconds for 10 minutes
5. Keep `BACKGROUND_JOBS_ENABLED` and queue-specific feature flags staged independently so observability can go live before traffic migration.

## Recommended alerts

- `APIAvailabilityBurn`: `sum(rate(nritax_api_failures_total[5m])) / sum(rate(nritax_http_requests_total[5m])) > 0.02`
- `AILatencyHigh`: `histogram_quantile(0.95, sum(rate(nritax_ai_latency_ms_bucket[5m])) by (le)) > 8000`
- `QueueBacklogGrowing`: `sum(nritax_queue_depth{state="waiting"}) by (queue) > 100`
- `DbLatencyHigh`: `histogram_quantile(0.95, sum(rate(nritax_db_operation_duration_ms_bucket[5m])) by (le)) > 250`
- `PaymentSuccessDrop`: `sum(rate(nritax_payment_attempts_total{status=~"verified|reconciled"}[15m])) / sum(rate(nritax_payment_attempts_total[15m])) < 0.97`
