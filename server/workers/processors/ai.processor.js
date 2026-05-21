export const processAiGenerationJob = async (payload) => {
  return {
    accepted: true,
    mode: "placeholder",
    jobType: "ai.generation",
    payloadSummary: {
      promptType: payload?.promptType || "unknown",
    },
  };
};

export const processAiEmbeddingJob = async (payload) => {
  return {
    accepted: true,
    mode: "placeholder",
    jobType: "ai.embedding",
    payloadSummary: {
      source: payload?.source || "unknown",
    },
  };
};
