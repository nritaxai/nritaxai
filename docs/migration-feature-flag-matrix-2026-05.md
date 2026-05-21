# nritax.ai Migration Feature Flag Matrix

| Flag | Phase | Default | Purpose | Safe Rollback |
|---|---|---:|---|---|
| `STRUCTURED_LOGGING_ENABLED` | 1 | `true` | structured logs | set `false` |
| `PROMETHEUS_METRICS_ENABLED` | 1 | `true` | metrics export | set `false` |
| `SENTRY_ENABLED` | 1 | `false` | error monitoring | set `false` |
| `OTEL_ENABLED` | 1 | `false` | tracing | set `false` |
| `AI_GATEWAY_ENABLED` | 1 | `true` in code, should be env-gated per environment | gateway wrapper | set `false` |
| `AI_GATEWAY_CACHE_ENABLED` | 1 | `true` | gateway cache | set `false` |
| `PAYMENT_RELIABILITY_ENABLED` | 1 | `true` | payment audit/reliability | set `false` if needed |
| `BACKGROUND_JOBS_ENABLED` | 2 | `false` | global queue cutover switch | set `false` |
| `CONSULTATION_QUEUE_ENABLED` | 2 | `false` | consultation notification queue | set `false` |
| `PDF_QUEUE_ENABLED` | 2 | `false` | PDF queue | set `false` |
| `PAYMENT_QUEUE_ENABLED` | 2 | `false` | payment reconciliation queue | set `false` |
| `AI_QUEUE_ENABLED` | 2/3 | `false` | AI async jobs | set `false` |
| `REPORT_QUEUE_ENABLED` | 2/3 | `false` | report queue | set `false` |
| `AI_GATEWAY_STREAMING_ENABLED` | 2 | `false` | streaming responses | set `false` |
| `AI_GATEWAY_ENABLE_PARALLEL_FALLBACK` | 2 | `false` | route fallback experiments | set `false` |
| `HYBRID_RETRIEVAL_CACHE_ENABLED` | 2 | `true` | retrieval cache | set `false` |
| `AI_GATEWAY_OLLAMA_ENABLED` | 3 | `false` | private LLM integration | set `false` |

## Operational note

Where the code default is permissive, production should still control behavior explicitly through environment values rather than relying on defaults during migration.
