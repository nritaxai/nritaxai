# nritax.ai Streaming AI UX Report

## Streaming AI Architecture

### Phase 1 implementation

- Client requests chat with:
  - `Accept: text/event-stream, application/json`
  - `x-chat-stream: true`
- Server keeps existing `/api/chat` contract.
- If `AI_GATEWAY_STREAMING_ENABLED=true` and the request opts in, the controller returns SSE.
- If streaming is disabled or unsupported, the same route returns the existing JSON payload.

### Why this rollout is safe

- No endpoint split was required.
- Existing callers still receive backward-compatible JSON.
- Streaming is opt-in from the client and gateable by env on the server.
- Interrupt and retry behavior remains request-local through `AbortController`.

### Current streaming model

- The AI gateway still resolves a full model answer first.
- The server emits the reply over SSE in paced chunks for progressive rendering.
- This improves perceived latency and response smoothness immediately without changing provider contracts.

### Next step

- Move from preview chunk streaming to direct provider token streaming once the gateway exposes provider-level stream adapters.

## Frontend Refactor Summary

### Shared transport

- `client/src/services/chatStreaming.ts`
  - SSE parsing
  - JSON fallback handling
  - first-chunk and completion analytics

### Reusable UX components

- `client/src/app/components/chat/TypingIndicator.tsx`
- `client/src/app/components/chat/StreamingSkeleton.tsx`
- `client/src/app/components/chat/ChatStatusBanner.tsx`

### Updated chat surfaces

- `client/src/app/pages/Chat.tsx`
  - progressive assistant rendering
  - retry-safe last prompt action
  - better interruption recovery
  - smoother mobile and desktop loading states
- `client/src/app/components/AIChat.tsx`
  - uses the same streaming transport
  - optimistic assistant placeholder
  - cache/recovery warnings
  - retry-safe interactions in compact popup mode

## UX Improvements Delivered

### Perceived latency

- Assistant placeholder appears immediately.
- Partial answer rendering begins before final completion.
- Cached-response recovery is explicitly surfaced to the user.

### Loading states

- Replaced plain "Thinking" text with:
  - animated typing indicator
  - streaming skeleton block
- Added clearer session and warning banners.

### Error recovery

- Aborted responses leave a recoverable transcript state.
- "Retry last" makes reconnect flows safe on flaky mobile networks.
- JSON fallback keeps older deployments functioning.

### Rendering performance

- Streaming message updates use `startTransition` to reduce UI jank during incremental rendering.
- Scroll behavior remains isolated to transcript panes so composers stay visible on mobile.

## Incremental Rollout Plan

1. Deploy server with `AI_GATEWAY_STREAMING_ENABLED=false`.
2. Deploy client with `VITE_AI_STREAMING_ENABLED=true`.
3. Enable server streaming in staging and validate:
   - `chat_stream_first_chunk`
   - `chat_stream_complete`
   - error rate parity with JSON mode
4. Enable production streaming for web first.
5. Expand to native app once first-chunk telemetry is stable.

## Performance Benchmarks

### Newly instrumented metrics

- `chat_stream_first_chunk`
- `chat_stream_complete`
- existing route render and browser performance metrics

### Success targets

- First visible AI chunk: `< 1200ms` after API response body starts
- Full streamed completion paint: `15-30%` faster perceived completion than full-response rendering
- No regression in:
  - auth expiry handling
  - plan limit handling
  - cached response rendering
  - mobile composer stability

### Validation method

- Compare production analytics between:
  - streaming-enabled sessions
  - JSON fallback sessions
- Track:
  - first chunk latency
  - completion latency
  - retry rate
  - abort rate
  - long tasks during chat

## Files To Review

- `server/services/chatStreaming.js`
- `server/Controllers/chatController.js`
- `client/src/services/chatStreaming.ts`
- `client/src/app/pages/Chat.tsx`
- `client/src/app/components/AIChat.tsx`
