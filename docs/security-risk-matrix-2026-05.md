# nritax.ai Security Risk Matrix

| Area | Risk | Likelihood | Impact | Current Mitigation | Residual Risk |
|---|---|---:|---:|---|---|
| Secrets | Environment secrets leaked or inconsistently managed | Medium | Critical | Startup secret readiness checks, server-side secret isolation | Medium |
| Webhooks | Unsigned third-party webhook consumers accept spoofed requests | Medium | High | Outbound HMAC signing on consultation, expert onboarding, Yukti | Low-Medium |
| Payments | Signature comparison side-channel or invalid webhook replay | Low | Critical | Timing-safe compare, durable payment audit trail | Low |
| Logging | PII leakage into app or audit logs | High | High | Redaction helpers applied to chatbot logs, audit metadata, fallback logger | Medium |
| User deletion | Hard-delete leaves orphaned PII in dependent collections | Medium | High | Anonymization of consultations/grievances plus privacy request audit | Low-Medium |
| Access control | JWT-only auth without MFA or RBAC | Medium | High | Route protection and rate limiting | Medium |
| Data at rest | Sensitive fields stored unencrypted in legacy collections | Medium | High | Optional AES-GCM utility for new protected fields, no risky migration | Medium |
| Supabase / RLS | Assumed RLS coverage cannot be proven | Unknown | High | None in repo; must validate externally | High |

## Priority actions after this pass

1. Move production secrets into a managed secret store with rotation runbooks.
2. Add DSAR export workflow and retention jobs.
3. Add RBAC and step-up auth for destructive actions.
4. Validate any external Supabase project separately if one exists.
