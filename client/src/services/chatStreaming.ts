import { trackEvent } from "./analytics";

export type StreamingChunkPayload = {
  chunk?: string;
  done?: boolean;
  cached?: boolean;
  provider?: string;
  routeTier?: string;
  usage?: unknown;
  taxRuleTimelines?: unknown[];
  responseTimeMs?: number;
  fallbackUsed?: boolean;
  modelUsed?: string;
};

type StreamChatParams = {
  url: string;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  onChunk?: (nextText: string, payload: StreamingChunkPayload) => void;
  onDone?: (result: {
    reply: string;
    payload: StreamingChunkPayload | null;
    usage?: unknown;
    taxRuleTimelines?: unknown[];
    cached?: boolean;
  }) => void;
};

const appendStreamingChunk = (currentText: string, nextChunk = "") => `${currentText}${nextChunk}`;

export const parseSseBlock = (block: string): { event: string; payload: StreamingChunkPayload | null } | null => {
  const trimmed = block.trim();
  if (!trimmed) return null;

  let event = "message";
  const dataLines: string[] = [];
  for (const line of trimmed.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) return null;

  try {
    return {
      event,
      payload: JSON.parse(dataLines.join("\n")),
    };
  } catch {
    return {
      event,
      payload: { chunk: dataLines.join("\n") },
    };
  }
};

const readJsonSafely = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const streamChatCompletion = async ({
  url,
  headers = {},
  body,
  signal,
  onChunk,
  onDone,
}: StreamChatParams) => {
  const startedAt = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
      "x-chat-stream": "true",
      ...headers,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await readJsonSafely(response);
    throw Object.assign(new Error(errorPayload?.message || errorPayload?.error || "Chat request failed"), {
      response: {
        status: response.status,
        data: errorPayload,
      },
    });
  }

  const contentType = response.headers.get("content-type") || "";
  let firstChunkTracked = false;

  if (contentType.includes("text/event-stream") && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assembledReply = "";
    let finalPayload: StreamingChunkPayload | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (!parsed?.payload) continue;
        finalPayload = parsed.payload;

        if (parsed.payload.chunk) {
          assembledReply = appendStreamingChunk(assembledReply, parsed.payload.chunk);
          onChunk?.(assembledReply, parsed.payload);
          if (!firstChunkTracked) {
            firstChunkTracked = true;
            void trackEvent("chat_stream_first_chunk", {
              path: "/chat",
              durationMs: Math.round(performance.now() - startedAt),
              metadata: {
                provider: parsed.payload.provider || "",
                routeTier: parsed.payload.routeTier || "",
              },
            });
          }
        }

        if (parsed.payload.done) {
          onDone?.({
            reply: assembledReply,
            payload: parsed.payload,
            usage: parsed.payload.usage,
            taxRuleTimelines: Array.isArray(parsed.payload.taxRuleTimelines) ? parsed.payload.taxRuleTimelines : [],
            cached: Boolean(parsed.payload.cached),
          });
        }
      }
    }

    void trackEvent("chat_stream_complete", {
      path: "/chat",
      durationMs: Math.round(performance.now() - startedAt),
      metadata: {
        streamed: true,
        provider: finalPayload?.provider || "",
        routeTier: finalPayload?.routeTier || "",
        cached: Boolean(finalPayload?.cached),
      },
    });

    return;
  }

  const data = await response.json();
  const reply = String(data?.reply || "").trim();
  if (Array.isArray(data?.sseMessages) && data.sseMessages.length) {
    let assembledReply = "";
    let finalPayload: StreamingChunkPayload | null = null;
    for (const eventText of data.sseMessages) {
      const parsed = parseSseBlock(String(eventText || ""));
      if (!parsed?.payload) continue;
      finalPayload = parsed.payload;
      if (parsed.payload.chunk) {
        assembledReply = appendStreamingChunk(assembledReply, parsed.payload.chunk);
        onChunk?.(assembledReply, parsed.payload);
      }
    }
    onDone?.({
      reply: assembledReply || reply,
      payload: finalPayload,
      usage: data?.usage,
      taxRuleTimelines: Array.isArray(data?.taxRuleTimelines) ? data.taxRuleTimelines : [],
      cached: Boolean(data?.cached),
    });
  } else {
    onDone?.({
      reply,
      payload: null,
      usage: data?.usage,
      taxRuleTimelines: Array.isArray(data?.taxRuleTimelines) ? data.taxRuleTimelines : [],
      cached: Boolean(data?.cached),
    });
  }

  void trackEvent("chat_stream_complete", {
    path: "/chat",
    durationMs: Math.round(performance.now() - startedAt),
    metadata: {
      streamed: false,
      cached: Boolean(data?.cached),
    },
  });
};
