# nritax.ai Security Architecture Review

## Security architecture review

- The application keeps authentication and payments in the Node backend, with JWT-based API access and Razorpay webhook verification. That remains intact.
- Security hardening added in this pass is intentionally backward compatible:
  - startup validation for required and recommended secrets
  - HTTP security headers at the API edge
  - redacted structured logging and redacted file-based chatbot logs
  - hashed-IP and hashed-email security audit events
  - signed outbound webhook calls for consultation, expert onboarding, and Yukti integrations
  - timing-safe signature comparison for payment verification and Razorpay webhook validation
  - consent tracking and privacy status APIs
  - deletion workflow that anonymizes dependent PII before removing the user record

## Current control status

- Secrets management:
  - Runtime now reports missing required and recommended secrets.
  - Repo still depends on environment variables; production should move those into a managed secret store such as AWS Secrets Manager, GCP Secret Manager, or Doppler.
- API key isolation:
  - Secrets remain server-side only.
  - Outbound webhook signing now uses per-integration secrets instead of reusing payment or JWT secrets.
- Secure audit logging:
  - Security audit events are stored in `SecurityAuditLog`.
  - IP and email are hashed; metadata is redacted before persistence.
- Encryption at rest:
  - New utility support is present for AES-256-GCM field encryption when `DATA_ENCRYPTION_KEY` is configured.
  - Existing collections were not migrated to encrypted fields to avoid production risk.
- PII protection:
  - Chat logs, queue audit summaries, and security events are now redacted.
  - User deletion anonymizes related consultation and grievance records.

## Validation notes

- Supabase RLS policies:
  - No Supabase integration, SQL migrations, or RLS definitions were found in this repository on May 14, 2026.
  - Result: this item is not validated here and should be marked as an external dependency gap.
- Authentication workflows:
  - JWT auth still functions as before.
  - Protected-route failures now generate security audit events.
- API security:
  - Added edge security headers and stronger secret/config readiness checks.
- Access controls:
  - Existing route-level `protect` middleware remains in place.
  - No role-based access control layer is present yet; this remains a medium-priority future control.
