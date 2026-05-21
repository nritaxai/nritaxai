# nritax.ai Rollback Strategy

## Rollback philosophy

- Roll back behavior before infrastructure.
- Keep data models in place; stop using them rather than deleting them.
- Prefer feature flags and traffic reversal to emergency code changes.

## Fast rollback controls

### Phase 1

- Disable `AI_GATEWAY_ENABLED`
- Disable `OTEL_ENABLED` if exporter pressure affects latency
- Keep `PAYMENT_RELIABILITY_ENABLED=true` only if audit-only behavior is safe; otherwise disable reliability extras while preserving base payment endpoints
- Use Argo Rollouts abort/undo if deployment-level regression appears

### Phase 2

- Disable `BACKGROUND_JOBS_ENABLED`
- Disable queue-specific flags individually:
  - `CONSULTATION_QUEUE_ENABLED`
  - `PDF_QUEUE_ENABLED`
  - `PAYMENT_QUEUE_ENABLED`
  - `AI_QUEUE_ENABLED`
  - `REPORT_QUEUE_ENABLED`
- Disable `AI_GATEWAY_STREAMING_ENABLED`
- Revert RAG retrieval traffic to legacy path

### Phase 3

- Disable `AI_GATEWAY_OLLAMA_ENABLED`
- Scale GPU worker to zero
- Freeze worker HPA and pin replicas
- Fail traffic fully back to primary hosted AI providers

## Deployment rollback

### API

- `kubectl argo rollouts abort nritax-api -n <namespace>`
- `kubectl argo rollouts undo nritax-api -n <namespace>`

### Workers

- `kubectl rollout undo deployment/nritax-worker -n <namespace>`
- If needed, set worker replicas to zero for the affected workload path

## Failure recovery workflows

### Queue failure

1. Disable the affected queue feature flag
2. Keep API serving traffic inline
3. Drain or inspect failed jobs
4. Re-enable only after worker error rate is normal

### AI routing regression

1. Disable route experimentation / parallel fallback
2. Force medium/default provider path
3. Compare prompt validation and provider error metrics

### Streaming regression

1. Disable streaming feature flag
2. Keep standard JSON completion path
3. Re-test SSE path in staging before retry

### Payment regression

1. Keep core verify and webhook endpoints live
2. Disable queue-backed reconciliation if needed
3. Retain payment audit logs for replay and incident analysis
