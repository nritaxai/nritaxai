# Multi-Agent Roadmap

## Near-Term Deliverables

- Multi-agent workflow registry
- Orchestrator scaffold
- Shared in-memory workflow context
- Agent communication/event recording
- Async AI workflow job type
- Human-review checkpoint design

## Roadmap

### Stage 1: Scaffolding

- deploy control-plane code only
- keep flags off
- validate no regressions in existing AI workflows

### Stage 2: Internal Workflow Trials

- run `document-review.v1` and `compliance-review.v1` for internal or operator-triggered jobs
- keep end-user chat on current `routeChatCompletion()`

### Stage 3: Async Worker Coordination

- expand `ai.workflow` queue usage
- add workflow wait-time and failure metrics
- isolate AI orchestration worker lanes if queue pressure grows

### Stage 4: Durable Memory

- replace in-process memory with Redis-backed shared context
- add workflow run persistence and step traces in Mongo
- support replay and compensating actions

### Stage 5: Human-in-the-Loop

- add review inbox model
- add status APIs for pending review checkpoints
- allow expert confirmation before final delivery for higher-risk compliance workflows

### Stage 6: Selective Chat Adoption

- allow the current chat controller or AI gateway to invoke the orchestrator only for selected high-value intents
- preserve current payload and response formats

## Suggested Metrics

- workflow start rate by `workflowId`
- workflow success/failure rate
- step timeout count
- average retries per step
- human review request rate
- async workflow queue wait p95

## Suggested Future Interfaces

- `POST /api/ai/workflows`
- `GET /api/ai/workflows/:runId`
- `POST /api/ai/workflows/:runId/review`

These are future endpoints only and should remain disabled until the internal workflows are proven stable.
