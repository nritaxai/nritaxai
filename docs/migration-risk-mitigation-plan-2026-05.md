# nritax.ai Migration Risk Mitigation Plan

## Risk assessment

| Risk | Phase | Likelihood | Impact | Mitigation | Recovery |
|---|---|---:|---:|---|---|
| Observability sink overload increases latency | 1 | Low | Medium | enable exporters gradually, keep local logs primary | disable sink / tracing |
| AI gateway introduces answer-quality drift | 1 | Medium | High | dark launch metrics, validation checks, prompt sampling | disable AI gateway |
| Payment reliability layer changes checkout behavior | 1 | Low | Critical | audit-first enablement, keep existing routes | disable reliability extras |
| Queue backlog grows faster than workers drain | 2 | Medium | High | queue-by-queue rollout, depth alerts, inline fallback | disable affected queue flag |
| Worker failures create user-visible delays | 2 | Medium | High | retry + dead-letter + one-workload-at-a-time enablement | route back inline |
| Streaming path breaks clients or proxies | 2 | Medium | Medium | keep JSON fallback, separate flag | disable streaming |
| Indexed RAG underperforms legacy retrieval | 2 | Medium | High | offline evaluation + shadow comparison | revert to legacy retrieval |
| Worker autoscaling oscillates | 3 | Medium | Medium | conservative HPA thresholds and queue p95 analysis | pin replica count |
| Private LLM path is slower / less stable | 3 | Medium | High | route gating and hosted fallback | disable private LLM flag |
| Multi-region adds split-brain operational complexity | 3 | Low | High | active-passive first, not active-active | fail back to primary region |

## Monitoring during migration

- Watch baseline-versus-candidate dashboards for each phase
- Track these comparison metrics:
  - legacy API p95 vs candidate API p95
  - legacy chat success rate vs AI gateway success rate
  - inline job completion time vs queued job completion time
  - legacy RAG grounded-answer score vs indexed RAG score
  - hosted-model cost/request vs private-LLM cost/request

## Recommended promotion gates

- 30 minutes green at staging
- 30 minutes green at 5% production
- 60 minutes green at 25% production
- 60 minutes green at 50% production
- 24 hours green before phase completion signoff for payment or queue architecture changes
