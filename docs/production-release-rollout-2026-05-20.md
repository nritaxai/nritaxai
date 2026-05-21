# Production Release Rollout - 2026-05-20

## 1. Full Implementation Plan
- Extend onboarding with mandatory terms acceptance, locked country selection, and backend validation.
- Gate Yukti with authenticated access plus accepted-terms middleware.
- Replace legal/company placeholders with `Billion Dollar Technologies Private Limited` across legal, email, metadata, and payment-facing UI.
- Extend PDF ingestion into a document-hash-based knowledge pipeline with chunk metadata, ingestion logs, duplicate prevention, and retrieval/context injection.
- Expand payment readiness reporting and preserve reliability, reconciliation, and webhook idempotency.
- Ship all changes as additive schema/service updates with rollback-safe docs and backfill scripts.

## 2. File-by-File Code Changes
- `server/Models/userModel.js`: Added additive onboarding/compliance fields.
- `server/Controllers/authController.js`: Enforced terms/country validation on signup and new social-account creation; added country policy and country change APIs; updated safe-user payloads and email branding.
- `server/Routes/authRoutes.js`: Exposed country-policy and country-change approval endpoints.
- `server/Middlewares/onboardingMiddleware.js`: Added reusable accepted-terms enforcement.
- `server/Routes/yuktiRoutes.js`: Switched Yukti chat to authenticated, accepted-terms-only access.
- `server/services/countryPolicyService.js`: Centralized country locking, pricing region, tax workflow, and AI compliance rules.
- `server/services/onboardingPolicy.js`: Centralized signup validation and compliance-state application.
- `server/services/legalConfig.js`: Centralized company/legal metadata.
- `server/Models/countryChangeRequestModel.js`: Added admin-approval workflow persistence.
- `server/Models/knowledgeDocumentModel.js`, `server/Models/knowledgeChunkModel.js`, `server/Models/knowledgeIngestionLogModel.js`: Added RAG ingestion metadata persistence.
- `server/services/knowledgeBaseService.js`: Added hashing, chunk ingestion, embeddings, logs, duplicate prevention, retrieval, and context assembly.
- `server/workers/processors/pdf.processor.js`: Extended async PDF ingestion to also populate the knowledge base.
- `server/Controllers/yuktiController.js`: Injects retrieved knowledge context and source references into Yukti payloads/responses.
- `server/Controllers/subscriptionController.js`, `server/Routes/subscriptionRoutes.js`, `server/services/paymentReadinessService.js`: Added payment readiness report and international/remittance metadata capture.
- `client/src/app/components/LoginModal.tsx`: Added required country selector, terms checkbox, disabled signup gating, and social-signup context propagation.
- `client/src/utils/api.ts`, `client/src/services/googleSignIn.ts`: Added onboarding payload support plus country-change APIs.
- `client/src/app/pages/Profile.tsx`: Added locked-country messaging and country-change request UI.
- `client/src/pages/AndroidYuktiPage.tsx`, `client/src/app/App.tsx`: Added front-end Yukti/legal-access guard adjustments.
- `client/src/app/pages/TermsAndConditions.tsx`, `client/src/pages/PrivacyPolicy.tsx`, `client/src/app/components/Footer.tsx`, `client/index.html`, checkout/pricing pages: Updated branding, metadata, and legal content.

## 3. DB Migration Scripts
- `server/migrations/20260520_onboarding_country_knowledge_backfill.js`
- `server/migrations/20260520_onboarding_country_knowledge_rollback.js`

## 4. API Updates
- `GET /api/auth/country-policy`
- `POST /api/auth/country-change-request`
- `GET /api/auth/country-change-requests`
- `POST /api/auth/country-change-requests/:requestId/decision`
- `GET /api/subscription/readiness-report`
- Updated `POST /api/auth/register`
- Updated `POST /api/auth/google-login`
- Updated `POST /api/auth/apple`
- Updated `POST /api/auth/linkedin`
- Updated `POST /api/yukti/chat`
- Updated `POST /api/subscription/create-subscription`

## 5. Frontend Components
- Signup modal now requires country selection plus terms acceptance before any signup continuation path.
- Profile page now explains the locked-country rule and supports admin-review requests.
- Terms and Privacy pages now present public branded legal content without missing PDF dependency.

## 6. Middleware Updates
- Added `requireAcceptedTerms("Yukti")` to block onboarding bypass at the API boundary.

## 7. AI Ingestion Pipeline
- PDF upload -> staging -> hashing -> chunk extraction -> optional Gemini embeddings -> chunk persistence -> retrieval.
- Added metadata tracking (`fileHash`, page/chunk info, source references, ingestion logs).
- Duplicate PDFs are skipped using file-hash detection.
- Existing queue/worker path remains intact and now performs incremental knowledge ingestion.

## 8. Payment Validation Improvements
- Added readiness-report endpoint for finance/admin review.
- Preserved idempotent webhook handling and reconciliation path.
- Added display-currency, settlement-currency, and international-payment metadata capture during checkout creation.

## 9. Security Improvements
- Server-side signup validation now rejects missing terms acceptance and unsupported country payloads.
- Yukti is no longer reachable through unauthenticated or terms-bypass API calls.
- Country changes are blocked at profile-update time and routed through an auditable approval workflow.

## 10. Rollback Strategy
- Roll back application code first; new Mongo fields are additive and backward compatible.
- Keep new fields in place during rollback to avoid destructive data operations.
- If needed, stop using new endpoints/UI while retaining stored onboarding and knowledge metadata.

## 11. Deployment Checklist
- Run `node server/migrations/20260520_onboarding_country_knowledge_backfill.js`.
- Verify `GET /readyz`, `GET /api/auth/country-policy`, and `GET /api/subscription/readiness-report`.
- Confirm signup works for email, Google, Apple, and LinkedIn with terms + country data.
- Confirm Yukti returns `403 TERMS_ACCEPTANCE_REQUIRED` when a legacy user without terms attempts access.
- Upload a PDF and verify both PDF indexing and knowledge-ingestion records are created.
- Validate webhook signature handling in staging before production cutover.

## 12. Production Readiness Report
- Status: ready for controlled rollout behind existing operational safeguards.
- Migration risk: low, because schema changes are additive.
- Auth/session risk: low, because existing login/session issuance is preserved.
- Payment risk: medium, because checkout display supports multiple currencies but settlement remains INR-first until gateway configuration expands.
- AI/RAG risk: medium-low, because ingestion extends the current queue flow and falls back cleanly to lexical retrieval when embeddings are unavailable.
