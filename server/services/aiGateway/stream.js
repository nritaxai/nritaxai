const serializeSseMessage = (event, data) => {
  const lines = [];
  if (event) {
    lines.push(`event: ${event}`);
  }

  const payload = typeof data === "string" ? data : JSON.stringify(data);
  for (const line of String(payload).split("\n")) {
    lines.push(`data: ${line}`);
  }

  return `${lines.join("\n")}\n\n`;
};

export const createSseEnvelope = ({
  requestId = "",
  routeTier = "",
  provider = "",
  chunk = "",
  done = false,
  meta = {},
}) =>
  serializeSseMessage(done ? "done" : "message", {
    requestId,
    routeTier,
    provider,
    chunk,
    done,
    ...meta,
  });

export const buildStreamingPreviewChunks = (text = "", chunkSize = 120) => {
  const normalized = String(text || "").trim();
  if (!normalized) return [];

  const chunks = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }
  return chunks;
};
