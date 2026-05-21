# nritax.ai Compliance Checklist

## GDPR and privacy readiness

- `Done`: user consent records are modeled and updateable through authenticated APIs.
- `Done`: self-service account deletion now creates a privacy request trail and anonymizes dependent PII before removing the user record.
- `Done`: privacy status endpoint can be used by client surfaces or support tooling.
- `Partial`: data export workflow is not yet implemented.
- `Partial`: retention schedule automation is not enforced in code.
- `Gap`: no dedicated DPO workflow, legal basis registry, or DSAR SLA automation exists in repo.

## Financial data handling

- `Done`: payment verification and webhook validation remain active.
- `Done`: payment audit logging exists and now benefits from redaction-aware security logging around related workflows.
- `Done`: signed outbound webhook requests reduce spoofing risk on non-payment partner integrations.
- `Partial`: field-level encryption utility exists, but existing financial records were not migrated to encrypted storage to avoid production risk.
- `Gap`: no KMS-backed key rotation automation is present in repo.

## Access controls and authentication

- `Done`: protected routes use JWT verification.
- `Done`: auth failures now emit security monitoring events.
- `Done`: auth endpoints keep existing rate limiting.
- `Gap`: no MFA, no device/session management view, and no admin RBAC layer are present.

## Security monitoring and reporting

- `Done`: Prometheus metrics now include security event counters.
- `Done`: security audit log model added for auth/privacy/webhook events.
- `Done`: `SECURITY.md` added for vulnerability reporting.
- `Gap`: no SIEM connector or alert routing config is stored in repo.

## Supabase / RLS

- `Blocked`: no Supabase project assets or RLS policies were found in this repository, so RLS validation cannot be completed here.
