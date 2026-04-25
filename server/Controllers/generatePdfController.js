const MAX_REPORT_ITEMS = 20;
const MAX_LABEL_LENGTH = 120;
const MAX_VALUE_LENGTH = 4000;
const MAX_NAME_LENGTH = 120;

const coerceSafeString = (value, maxLength) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
};

const validatePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Invalid request body." };
  }

  const userName = coerceSafeString(payload.userName, MAX_NAME_LENGTH);
  if (!userName) {
    return { error: "A valid userName is required." };
  }

  if (!Array.isArray(payload.reportData) || payload.reportData.length === 0 || payload.reportData.length > MAX_REPORT_ITEMS) {
    return { error: "reportData must be a non-empty array." };
  }

  const reportData = [];
  for (const item of payload.reportData) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each report item must be an object." };
    }

    const label = coerceSafeString(item.label, MAX_LABEL_LENGTH);
    const value = coerceSafeString(item.value, MAX_VALUE_LENGTH);
    if (!label || !value) {
      return { error: "Each report item requires valid label and value fields." };
    }

    reportData.push({ label, value });
  }

  return { userName, reportData };
};

export const generatePdf = async (req, res) => {
  const validatedPayload = validatePayload(req.body);
  if (validatedPayload.error) {
    return res.status(400).json({
      success: false,
      message: validatedPayload.error,
    });
  }

  // The client already renders the final PDF, so the server only returns
  // validated report data and avoids any frontend-only rendering packages.
  return res.status(200).json({
    success: true,
    message: "Report data validated successfully.",
    data: validatedPayload,
  });
};
