# Auth Security Rollout - May 14, 2026

## Current architecture

- Production auth in this repository is a custom Node/Express plus MongoDB flow.
- The live client still authenticates with bearer JWTs and existing login/signup/social entry points.
- New logins now also create a server-tracked `AuthSession` record with:
  - session ID
  - device/platform fingerprint summary
  - last activity timestamp
  - refresh-token hash
  - revocation and expiry state
- Access tokens remain backward compatible.
  - Legacy JWTs without `sid` continue to validate.
  - New JWTs include `sid`, `roles`, `tenantId`, and `ver`.

## Security improvements

- Session reliability
  - Added server-side session registry and refresh-token rotation.
  - Added idle/expired session handling in auth middleware.
  - Added explicit logout and logout-all endpoints that revoke server sessions.
- Secure token handling
  - Web clients can now renew access via an `HttpOnly` refresh cookie.
  - Client token persistence now derives expiry from JWT `exp` instead of assuming a fixed window.
  - Existing bearer-header flow remains intact for backward compatibility.
- Access control
  - Existing enterprise RBAC middleware remains feature-flagged.
  - Sensitive routes now declare permission requirements for analytics, payment recovery/debug, and PDF management.
- Monitoring and audit
  - Login success/failure, session creation, refresh, revocation, and suspicious login bursts now write security audit logs.
  - Added auth metrics:
    - `nritax_auth_events_total`
    - `nritax_auth_sessions_active`
  - Suspicious repeated login failures trigger security alert audit events.

## New/updated endpoints

- `POST /api/auth/session/refresh`
- `GET /api/auth/sessions`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`

These are additive and do not replace existing login or profile routes.

## Supabase validation

- As of May 14, 2026, no Supabase Auth configuration, SQL migrations, RLS policies, or Supabase client/server auth wiring were found in this repository.
- Result: Supabase Auth security cannot be validated from repo contents alone.
- If a separate Supabase project exists in production, validate externally:
  - Auth providers enabled
  - refresh-token rotation settings
  - session lifetime settings
  - RLS policies for every exposed table
  - service-role key storage and usage boundaries

## Low-risk rollout notes

- Existing login and user workflows remain unchanged at the UI level.
- Legacy access tokens still work until natural expiry.
- RBAC enforcement remains gated by `ENTERPRISE_RBAC_ENABLED`.
- Refresh support is additive for clients that receive the new refresh cookie.

## Recommended follow-ups

- Add an authenticated user-facing "manage devices" screen using `GET /api/auth/sessions`.
- Enable `ENTERPRISE_RBAC_ENABLED` first in staging and verify admin/support/payment routes.
- Consider shortening `AUTH_ACCESS_TOKEN_TTL` further after observing refresh success rates.
- If production truly uses Supabase elsewhere, audit that environment directly before claiming Supabase hardening is complete.
