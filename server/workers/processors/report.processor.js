export const processReportGenerationJob = async (payload) => {
  return {
    accepted: true,
    mode: "placeholder",
    jobType: "report.generation",
    payloadSummary: {
      userId: payload?.userId || null,
      reportType: payload?.reportType || "generic",
    },
  };
};
