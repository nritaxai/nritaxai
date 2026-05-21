# Redis Cache Strategy

## Goals

- Reduce median and tail latency for repeated AI, RAG, auth, analytics, and content reads.
- Increase horizontal scalability by shifting repeated reads off application pods and MongoDB.
- Preserve existing production behavior with local-memory fallback when Redis is unavailable.

## Rollout Model

- `REDIS_CACHE_ENABLED=true` enables distributed cache reads and writes.
- `REDIS_URL` present and reachable activates Redis-backed caching.
- If Redis is disabled, misconfigured, or unavailable, the app continues with bounded in-process caches and normal source-of-truth reads.
- Queue-backed workflows remain independently controlled by existing queue feature flags.

## Cache Layers

- `ai_gateway_response`
  Reuses AI gateway completions for repeated low-entropy prompts.
- `chat_response`
  Reuses chat responses where existing prompt hashing already considers the relevant request context.
- `rag_embedding_reuse`
  Reuses embedding vectors for repeated reranking and retrieval inputs.
- `chat_session`
  Shares short-lived chat session context across horizontally scaled API instances.
- `auth_user_session`
  Reduces repeated `User.findById` reads on authenticated requests.
- `user_profile_response`
  Caches sanitized profile payloads returned by profile APIs.
- `user_privacy_status`
  Caches user and consent payloads for privacy settings reads.
- `banner_response`
  Caches homepage banner content with explicit invalidation on update.
- `analytics_summary`
  Caches the expensive analytics summary aggregation and invalidates after new event writes.

## TTL Strategy

- AI responses: 10 minutes distributed, 2 minutes local default.
- RAG embedding reuse: 30 minutes distributed, 2 minutes local default.
- Chat sessions: 30 minutes distributed to match active conversational use.
- Auth/session user reads: 5 minutes distributed.
- Profile response: 3 minutes distributed.
- Privacy status: 2 minutes distributed.
- Banner content: 5 minutes distributed.
- Analytics summary: 60 seconds distributed.

## Invalidation Rules

- Profile updates, password changes, privacy changes, and account deletion clear:
  - `auth_user_session`
  - `user_profile_response`
  - `user_privacy_status`
- Banner writes clear `banner_response`.
- Analytics event writes clear `analytics_summary`.
- Existing AI and session caches continue to expire by TTL to avoid broad invalidation complexity.

## Query Deduplication

- `cacheService.getOrSetCachedValue` deduplicates in-flight loads per cache key inside each process.
- This prevents stampedes when a hot key expires under concurrent requests.
- Redis provides distributed value reuse; local in-flight dedupe reduces duplicate source reads during the refill window.

## Failure Handling

- Redis failures are logged as warnings and do not fail user requests.
- Cache reads fall back to the source of truth on misses or Redis errors.
- Cache writes fall back to local-memory retention when distributed writes fail.
- Readiness exposes cache state separately so operations can detect degraded distributed caching without taking the API fully offline.

## Monitoring

- Prometheus series:
  - `nritax_cache_requests_total`
  - `nritax_cache_operation_duration_ms`
  - `nritax_cache_backend_state`
- Grafana additions in `infra/observability/grafana/nritax-platform-overview.json`:
  - Redis cache backend state
  - Cache operation P95
  - Cache hit rate by layer

## Benchmark Plan

- Baseline before rollout:
  - `/api/chat` repeat prompt latency
  - `/api/auth/profile` authenticated read latency
  - `/api/banner-updates` GET latency
  - `/api/analytics/summary` latency and file read count
- Included harness:
  - `node scripts/redis-cache-benchmark.mjs`
  - Configure `BENCH_BASE_URL`, `BENCH_CONCURRENCY`, `BENCH_ITERATIONS`, and `BENCH_BEARER_TOKEN` as needed.
- Expected improvements after enabling Redis cache:
  - 30-60% lower repeat AI response latency
  - 40-80% lower repeated auth/profile read latency
  - 50%+ lower banner and analytics summary read latency for warm keys
  - Higher worker throughput during AI spikes due to less duplicate retrieval and response work

## Safe Adoption Steps

1. Deploy code with `REDIS_CACHE_ENABLED=false` and confirm no behavior changes.
2. Enable `REDIS_CACHE_ENABLED=true` in one environment with Redis connectivity.
3. Watch cache hit rate, backend state, Redis memory, and API latency panels.
4. Expand traffic gradually, starting with internal/staging and then a partial production rollout.
5. Tune TTLs and per-layer key cardinality after observing real hit rates.
