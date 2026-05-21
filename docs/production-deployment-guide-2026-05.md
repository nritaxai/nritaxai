# Production Deployment Guide

## Before First Use

Configure GitHub Environments:

- `staging`
- `production`

Add environment variables:

- `STAGING_HEALTHCHECK_URL`
- `PRODUCTION_HEALTHCHECK_URL`

Add environment secrets:

- `KUBE_CONFIG_STAGING`
- `KUBE_CONFIG_PRODUCTION`
- `REGISTRY`
- `REGISTRY_USERNAME`
- `REGISTRY_PASSWORD`
- `IMAGE_REPOSITORY`
- `WORKER_IMAGE_REPOSITORY`
- `ALERT_WEBHOOK_URL` optional

Enable required reviewers on the `production` environment.

## Standard Release Flow

1. Merge into `main` after CI passes.
2. Run `Build And Publish Images`.
3. Choose a stable image tag such as a commit SHA or release tag.
4. Run `Deploy Staging` with that image tag.
5. Validate:
   - staging `/health`
   - staging `/readyz`
   - Grafana dashboards
   - Sentry or alert noise
6. Run `Deploy Production Canary` with `auto_promote=false`.
7. Observe canary metrics and logs.
8. If healthy, rerun `Deploy Production Canary` with `auto_promote=true` for the same image tag, or promote manually through Argo Rollouts.

## Staging Validation Checklist

- API health check returns success.
- Worker deployment reaches ready state.
- No elevated 5xx responses.
- Queue depth remains within normal range.
- Memory and CPU stay within expected ranges.
- No unexpected auth, payment, or PDF-processing regressions.

## Production Canary Checklist

- `/health` remains healthy.
- `/readyz` stays ready during canary steps.
- Error rate is not elevated.
- Latency does not regress materially.
- Queue backlog does not spike abnormally.
- Payment and authentication flows remain stable.

## Rollback Guide

Use `Rollback Production` when:

- canary error rate rises
- latency regresses
- readiness becomes unstable
- worker rollout introduces failures

Default rollback behavior:

- abort current canary if active
- undo API rollout to previous stable
- undo worker rollout
- verify health endpoint

If needed, provide a specific `rollback_target` revision.

## Manual Commands

Useful cluster commands that match the workflow behavior:

```bash
kubectl argo rollouts get rollout nritax-api -n nritax-production
kubectl argo rollouts promote nritax-api -n nritax-production
kubectl argo rollouts abort nritax-api -n nritax-production
kubectl argo rollouts undo nritax-api -n nritax-production
kubectl rollout status deployment/nritax-worker -n nritax-production
```

## Migration Policy

- Keep `run_migrations=false` unless there is an explicit reviewed migration plan.
- Never combine destructive schema changes with first-time rollout automation.
- Prefer additive schema changes and behavioral rollback.

## Incident Response Notes

- Deployment failures should page or notify through `ALERT_WEBHOOK_URL`.
- Record:
  - image tag
  - deployment workflow run URL
  - observed health symptoms
  - rollback revision used
- After rollback, keep the failed image tag blocked from re-promotion until reviewed.
