# nritax.ai AI Cost Optimization Plan

## Goals

- Reduce premium-model usage without changing public APIs.
- Maintain answer quality through validation, fallback routing, and conservative token budgets.
- Reach the target routing mix over time:
  - 70% lightweight
  - 20% RAG + small models
  - 10% advanced reasoning

## Current Cost Drivers

- `server/services/aiService.js` previously enforced a 2048-token minimum on OpenRouter and Gemini requests, which over-allocated output tokens for simple prompts.
- `server/services/aiGateway/router.js` sent most medium-tier questions directly to premium providers instead of trying a lightweight pass first.
- `server/Controllers/chatController.js` builds large single-message prompts for RAG responses, which increases input-token cost on every retry and fallback.
- AI gateway metrics tracked latency, failures, and cache hits but did not expose estimated token or spend signals.

## Production-Ready Changes Implemented

### 1. Cost-aware routing

- File: `server/services/aiGateway/router.js`
- Small tasks stay on lightweight routes.
- Medium tasks now use a lightweight-first, premium-fallback sequence:
  1. OpenRouter small model
  2. Optional Ollama fallback
  3. Premium OpenRouter model
  4. Gemini direct
- Large tasks remain on advanced models, but the classifier is stricter so treaty mentions alone do not automatically force the premium lane.

### 2. Token budget controls

- File: `server/services/aiService.js`
- Removed the old implicit 2048-token floor.
- Added bounded token defaults by route tier through the gateway:
  - `small`: 384 default, 640 hard cap
  - `medium`: 768 default, 1152 hard cap
  - `large`: 1400 default, 1792 hard cap
- This keeps short classification and extraction requests from paying for large completion windows.

### 3. Prompt and context compression

- File: `server/services/aiGateway/costEngineering.js`
- Added compact system prompts for small and medium routes.
- Added conservative context trimming to preserve the latest messages while preventing oversized upstream payloads.
- Compression is feature-flag controlled through:
  - `AI_CONTEXT_COMPRESSION_ENABLED`
  - `AI_COST_AWARE_ROUTING_ENABLED`
  - `AI_TOKEN_TRACKING_ENABLED`

### 4. Response caching and embedding reuse

- AI gateway response caching remains active and unchanged for API compatibility.
- Added embedding reuse cache for the existing RAG rerank path in `server/Controllers/chatController.js`.
- Embedding reuse only affects the already-gated rerank path and does not change default production retrieval behavior.

### 5. Cost monitoring and analytics

- Files:
  - `server/services/metrics.js`
  - `server/services/aiGateway/metricsStore.js`
  - `infra/observability/grafana/nritax-ai-cost-efficiency.json`
- Added estimated AI metrics:
  - total input tokens
  - total output tokens
  - estimated USD spend
  - routing strategy mix
- Added JSON rollup storage in `logs/ai_gateway_metrics.json` for provider mix, strategy mix, token totals, and average estimated cost.

## Optimized Routing Logic

```text
Request
  -> route classification
  -> token budget + prompt compression
  -> lightweight route first for small/medium
  -> response validation
  -> premium fallback only if needed
  -> cache eligible response
  -> token/cost telemetry emission
```

## Monitoring Dashboard

- Dashboard file: `infra/observability/grafana/nritax-ai-cost-efficiency.json`
- Panels included:
  - Estimated AI spend over time
  - Token volume by direction and model family
  - Lightweight / RAG-small / advanced routing shares
  - AI P95 latency by route tier
  - Estimated cost per 1K requests

## Safe Rollout Plan

1. Enable token tracking and dashboard ingestion first.
2. Keep cost-aware routing enabled for small and medium tiers only.
3. Watch:
   - validation failures
   - P95 latency
   - cache hit rate
   - estimated cost per 1K requests
4. Compare quality and fallback rate before tightening large-tier thresholds.
5. Roll back by disabling:
   - `AI_COST_AWARE_ROUTING_ENABLED`
   - `AI_CONTEXT_COMPRESSION_ENABLED`

## Performance Comparison Metrics

- `nritax_ai_tokens_total`
- `nritax_ai_estimated_cost_usd_total`
- `nritax_ai_route_strategy_total`
- `nritax_ai_latency_ms`
- existing cache, API, queue, and DB metrics for correlated analysis

## Risk Notes

- Token and spend are estimated heuristically from prompt and response size, so they should be used for trend analysis rather than billing reconciliation.
- Large tax-analysis prompts still preserve premium fallback to protect answer quality.
- Existing request and response contracts remain unchanged.
