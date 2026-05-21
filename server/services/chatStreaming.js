import { buildStreamingPreviewChunks, createSseEnvelope } from "./aiGateway/stream.js";

const DEFAULT_STREAM_CHUNK_DELAY_MS = Math.max(Number(process.env.AI_STREAM_CHUNK_DELAY_MS || 18), 0);
const DEFAULT_STREAM_CHUNK_SIZE = Math.max(Number(process.env.AI_STREAM_CHUNK_SIZE || 72), 24);

const delay = (durationMs = 0) =>
  new Promise((resolve) => {
    if (durationMs <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, durationMs);
  });

export const isStreamingChatRequest = (req) => {
  const acceptHeader = String(req.headers?.accept || "").toLowerCase();
  const explicitHeader = String(req.headers?.["x-chat-stream"] || "").toLowerCase();
  const explicitQuery = String(req.query?.stream || "").toLowerCase();
  return (
    acceptHeader.includes("text/event-stream") ||
    explicitHeader === "true" ||
    explicitQuery === "true" ||
    explicitQuery === "1"
  );
};

export const startSse = (res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
};

export const writeSseEvent = (res, payload = "") => {
  res.write(String(payload || ""));
  res.flush?.();
};

export const streamChatReply = async ({
  req,
  res,
  reply = "",
  provider = "",
  routeTier = "",
  usage = null,
  taxRuleTimelines = [],
  cached = false,
  meta = {},
  chunkDelayMs = DEFAULT_STREAM_CHUNK_DELAY_MS,
  chunkSize = DEFAULT_STREAM_CHUNK_SIZE,
}) => {
  startSse(res);

  const requestId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const chunks = buildStreamingPreviewChunks(String(reply || ""), chunkSize);
  let requestClosed = false;
  const handleClose = () => {
    requestClosed = true;
  };

  req.on("close", handleClose);

  try {
    if (!chunks.length) {
      writeSseEvent(
        res,
        createSseEnvelope({
          requestId,
          routeTier,
          provider,
          chunk: "",
          done: true,
          meta: {
            cached,
            usage,
            taxRuleTimelines,
            ...meta,
          },
        })
      );
      res.end();
      return;
    }

    for (const chunk of chunks) {
      if (requestClosed) return;
      writeSseEvent(
        res,
        createSseEnvelope({
          requestId,
          routeTier,
          provider,
          chunk,
          done: false,
        })
      );
      await delay(chunkDelayMs);
    }

    if (requestClosed) return;
    writeSseEvent(
      res,
      createSseEnvelope({
        requestId,
        routeTier,
        provider,
        chunk: "",
        done: true,
        meta: {
          cached,
          usage,
          taxRuleTimelines,
          ...meta,
        },
      })
    );
    res.end();
  } finally {
    req.off?.("close", handleClose);
  }
};
