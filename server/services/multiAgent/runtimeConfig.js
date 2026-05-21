const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

export const isMultiAgentOrchestrationEnabled = () =>
  parseBoolean(process.env.MULTI_AGENT_ORCHESTRATION_ENABLED, false);

export const isMultiAgentAsyncEnabled = () =>
  parseBoolean(process.env.MULTI_AGENT_ASYNC_ENABLED, false);

export const isMultiAgentHumanReviewEnabled = () =>
  parseBoolean(process.env.MULTI_AGENT_HUMAN_REVIEW_ENABLED, false);
