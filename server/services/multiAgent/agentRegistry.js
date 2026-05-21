import { AGENT_CAPABILITIES, AGENT_IDS } from "./types.js";

const registry = [
  {
    id: AGENT_IDS.orchestrator,
    capabilities: [AGENT_CAPABILITIES.workflow_orchestration],
    mode: "control-plane",
    timeoutMs: 3000,
    maxRetries: 0,
  },
  {
    id: AGENT_IDS.taxReasoning,
    capabilities: [AGENT_CAPABILITIES.tax_reasoning, AGENT_CAPABILITIES.validation],
    mode: "sync_or_async",
    timeoutMs: 20000,
    maxRetries: 1,
  },
  {
    id: AGENT_IDS.documentExtraction,
    capabilities: [AGENT_CAPABILITIES.document_extraction],
    mode: "async_preferred",
    timeoutMs: 30000,
    maxRetries: 2,
  },
  {
    id: AGENT_IDS.validation,
    capabilities: [AGENT_CAPABILITIES.validation],
    mode: "sync",
    timeoutMs: 8000,
    maxRetries: 1,
  },
  {
    id: AGENT_IDS.compliance,
    capabilities: [AGENT_CAPABILITIES.compliance_check, AGENT_CAPABILITIES.validation],
    mode: "sync_or_async",
    timeoutMs: 10000,
    maxRetries: 1,
  },
  {
    id: AGENT_IDS.conversational,
    capabilities: [AGENT_CAPABILITIES.conversation],
    mode: "sync",
    timeoutMs: 15000,
    maxRetries: 1,
  },
  {
    id: AGENT_IDS.humanReview,
    capabilities: [AGENT_CAPABILITIES.human_review],
    mode: "human",
    timeoutMs: 0,
    maxRetries: 0,
  },
];

export const getRegisteredAgents = () => [...registry];

export const findAgentById = (agentId = "") =>
  registry.find((agent) => agent.id === String(agentId || "").trim()) || null;

export const findAgentsByCapability = (capability = "") =>
  registry.filter((agent) => agent.capabilities.includes(String(capability || "").trim()));
