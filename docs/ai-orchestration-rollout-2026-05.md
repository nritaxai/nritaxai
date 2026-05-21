# nritax.ai AI Orchestration Rollout

## Architecture Diagram

```mermaid
flowchart TD
    Client[React / Mobile Client] --> ChatAPI[/api/chat]
    ChatAPI --> Controller[Legacy chatController]
    Controller --> Gateway[AI Gateway]
    Gateway --> Cache[Gateway Cache + In-flight Dedupe]
    Gateway --> Router[Model Router]
    Router --> OR[OpenRouter]
    Router --> GEM[Gemini]
    Router --> OLL[Ollama]
    Controller --> RAG[Legacy PDF RAG]
    Gateway --> Metrics[Gateway Metrics]
```

## Hybrid RAG Diagram

```mermaid
flowchart TD
    HybridAPI[/api/chat-hybrid] --> HybridService[Hybrid Chat Service]
    HybridService --> Embed[Gemini Embeddings]
    Embed --> Retriever[Hybrid Retriever]
    Retriever --> Cache[Retrieval Cache]
    Retriever --> Vector[Mongo Vector Search]
    Retriever --> Rerank[Keyword Re-rank]
    HybridService --> Provider[Provider Abstraction]
    Provider --> OR[OpenRouter]
    Provider --> GEM[Gemini]
    Provider --> OLL[Ollama]
```

## Production Changes

- Centralized orchestration now lives in `server/services/aiGateway`.
- Model routing supports `OpenRouter`, `Gemini`, and optional `Ollama`.
- Gateway caching and in-flight dedupe reduce repeated latency spikes.
- Parallel fallback can be enabled behind `AI_GATEWAY_ENABLE_PARALLEL_FALLBACK`.
- Streaming support is prepared as SSE envelopes without changing the current chat contract.
- Hybrid retrieval now caches vector results and re-ranks them with lightweight keyword overlap.

## Feature Flags

- `AI_GATEWAY_ENABLED=true`
- `AI_GATEWAY_CACHE_ENABLED=true`
- `AI_GATEWAY_STREAMING_ENABLED=false`
- `AI_GATEWAY_OLLAMA_ENABLED=false`
- `AI_GATEWAY_ENABLE_PARALLEL_FALLBACK=false`
- `HYBRID_RETRIEVAL_CACHE_ENABLED=true`
- `HYBRID_OLLAMA_ENABLED=false`

## Migration Strategy

1. Deploy with gateway enabled, Ollama disabled, parallel fallback disabled.
2. Observe `logs/ai_gateway_metrics.json` for cache hit rate, latency, and provider mix.
3. Enable Ollama only for internal traffic or staging first.
4. Enable parallel fallback only after confirming provider cost ceilings.
5. Add a dedicated SSE route later using `routeChatCompletionStream()` once the client is ready.

## Refactor Plan

### Phase 1

- Keep `/api/chat` unchanged.
- Use gateway cache and routing under the hood.
- Continue storing legacy response payloads exactly as before.

### Phase 2

- Move hybrid and legacy provider logic to a shared provider package.
- Introduce dedicated streaming endpoints.
- Add Redis-backed shared cache when multiple API instances are active.

### Phase 3

- Move RAG indexing and embeddings to async workers.
- Shift request metrics from JSON logs to OpenTelemetry + Prometheus.
- Add cost-aware hard budgets per provider and task type.
