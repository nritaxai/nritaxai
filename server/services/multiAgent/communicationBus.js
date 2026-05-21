const busEvents = [];

export const recordAgentMessage = ({
  workflowId = "",
  workflowRunId = "",
  fromAgentId = "",
  toAgentId = "",
  kind = "context",
  payload = {},
} = {}) => {
  const event = {
    workflowId,
    workflowRunId,
    fromAgentId,
    toAgentId,
    kind,
    payload,
    createdAt: new Date().toISOString(),
  };
  busEvents.push(event);
  return event;
};

export const listAgentMessages = ({ workflowRunId = "" } = {}) =>
  busEvents.filter((event) => !workflowRunId || event.workflowRunId === workflowRunId);
