import { MEMORY_SCOPES } from "./types.js";

const memoryBuckets = new Map();

const buildMemoryKey = ({ scope = MEMORY_SCOPES.request, scopeId = "" }) =>
  `${String(scope || MEMORY_SCOPES.request)}:${String(scopeId || "").trim()}`;

export const createWorkflowMemory = ({ scope = MEMORY_SCOPES.request, scopeId = "", seed = {} } = {}) => {
  const key = buildMemoryKey({ scope, scopeId });
  const value = {
    scope,
    scopeId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    context: { ...seed },
    messages: [],
    artifacts: [],
  };
  memoryBuckets.set(key, value);
  return value;
};

export const getWorkflowMemory = ({ scope = MEMORY_SCOPES.request, scopeId = "" } = {}) =>
  memoryBuckets.get(buildMemoryKey({ scope, scopeId })) || null;

export const upsertWorkflowMemory = ({ scope = MEMORY_SCOPES.request, scopeId = "", patch = {} } = {}) => {
  const current = getWorkflowMemory({ scope, scopeId }) || createWorkflowMemory({ scope, scopeId });
  const next = {
    ...current,
    ...patch,
    context: {
      ...(current.context || {}),
      ...(patch.context || {}),
    },
    messages: Array.isArray(patch.messages) ? patch.messages : current.messages,
    artifacts: Array.isArray(patch.artifacts) ? patch.artifacts : current.artifacts,
    updatedAt: new Date().toISOString(),
  };
  memoryBuckets.set(buildMemoryKey({ scope, scopeId }), next);
  return next;
};

export const appendWorkflowArtifact = ({ scope = MEMORY_SCOPES.request, scopeId = "", artifact }) => {
  const current = getWorkflowMemory({ scope, scopeId }) || createWorkflowMemory({ scope, scopeId });
  return upsertWorkflowMemory({
    scope,
    scopeId,
    patch: {
      artifacts: [...(current.artifacts || []), artifact],
    },
  });
};

export const appendWorkflowMessage = ({ scope = MEMORY_SCOPES.request, scopeId = "", message }) => {
  const current = getWorkflowMemory({ scope, scopeId }) || createWorkflowMemory({ scope, scopeId });
  return upsertWorkflowMemory({
    scope,
    scopeId,
    patch: {
      messages: [...(current.messages || []), message],
    },
  });
};
