import dotenv from "dotenv";

dotenv.config();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_REFERER = process.env.OPENROUTER_SITE_URL || "https://www.nritax.ai";
const OPENROUTER_TITLE = process.env.OPENROUTER_APP_NAME || "NRI Tax AI";
const OPENROUTER_TIMEOUT_MS = Math.max(Number(process.env.OPENROUTER_TIMEOUT_MS || 20000), 5000);
const GEMINI_TIMEOUT_MS = Math.max(Number(process.env.GEMINI_TIMEOUT_MS || 20000), 5000);

const DEFAULT_OPENROUTER_MODELS = [
  process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o",
  "meta-llama/llama-3.1-70b-instruct",
];

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-pro";

const CONTINUATION_PROMPT =
  "Please continue your previous response from exactly where you stopped. Keep the same structure and formatting, and finish the answer completely.";

const MID_SENTENCE_PATTERN = /[a-z0-9,:;(\[]$/i;

const createTimeoutSignal = (timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
};

const createHttpError = (provider, status, bodyText) => {
  const error = new Error(`${provider} error: ${status}${bodyText ? ` - ${bodyText}` : ""}`);
  error.status = status;
  return error;
};

const isRetryableError = (error) => {
  if (!error) return false;
  if (error.name === "AbortError") return true;

  const status = Number(error.status || 0);
  if (!status) return true;

  return status === 429 || status >= 500;
};

export const withRetry = async (fn, retries = 2, label = "AI request") => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries || !isRetryableError(error)) {
        throw error;
      }

      console.warn(`[AI] ${label} failed on attempt ${attempt + 1}. Retrying...`, error.message);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw new Error(`[AI] ${label} exhausted retries`);
};

const normalizeMessageContent = (content) => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
};

const normalizeChatMessages = (messages = []) =>
  messages
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: normalizeMessageContent(message?.content),
    }))
    .filter((message) => message.content);

const needsContinuation = (text = "", finishReason = "") => {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  if (finishReason === "length" || finishReason === "max_tokens") return true;
  return MID_SENTENCE_PATTERN.test(trimmed);
};

const mergeContinuation = (initialText = "", continuationText = "") => {
  const first = String(initialText || "").trimEnd();
  const second = String(continuationText || "").trimStart();

  if (!first) return second;
  if (!second) return first;
  if (first.endsWith("-")) return `${first}${second}`;

  return `${first}\n\n${second}`;
};

const buildOpenRouterModels = (preferredModel) => {
  const models = preferredModel ? [preferredModel, ...DEFAULT_OPENROUTER_MODELS] : DEFAULT_OPENROUTER_MODELS;
  return [...new Set(models.map((model) => String(model || "").trim()).filter(Boolean))];
};

const buildContinuationMessages = (messages, partialResponse) => [
  ...messages,
  { role: "assistant", content: partialResponse },
  { role: "user", content: CONTINUATION_PROMPT },
];

export const NRI_TAX_SYSTEM_PROMPT = `
You are an expert NRI (Non-Resident Indian) tax advisor with deep knowledge of:
- Indian Income Tax Act 1961
- DTAA (Double Taxation Avoidance Agreements) between India and all countries
- NRI residential status determination (Section 6)
- NRE/NRO/FCNR account taxation
- Capital gains tax for NRIs
- TDS on NRI income
- Foreign income reporting
- FEMA regulations
- Form 15CA/15CB requirements
- ITR filing for NRIs (ITR-2, ITR-3)
- Tax planning strategies for NRIs

RESPONSE GUIDELINES:
1. Always give COMPLETE answers - never cut off mid-sentence.
2. Use clear formatting:
   - Use **bold** for important terms
   - Use numbered lists for steps
   - Use bullet points for options
   - Use headers (##) for sections
3. Structure every response:
   - Direct answer first
   - Detailed explanation
   - Practical next steps
   - Disclaimer if needed
4. Be specific with:
   - Section numbers (e.g., Section 80C, Section 195)
   - Tax rates (e.g., 20% + surcharge + cess)
   - Thresholds (e.g., Rs. 2.5 lakh basic exemption)
   - Form numbers (e.g., Form 15CA, Form 67)
5. Always mention relevant deadlines.
6. If the question is outside tax scope, politely redirect to tax topics.
7. End complex answers with: "For your specific situation, consulting a qualified CA is recommended."

NEVER:
- Give incomplete answers
- Say "I cannot help with that" for tax questions
- Give generic non-specific answers
- Ignore the specific country mentioned by the user
`.trim();

export const AI_DEFAULT_MAX_TOKENS = Math.max(Number(process.env.CHAT_MAX_TOKENS || 2048), 2048);
export const AI_DEFAULT_TEMPERATURE = 0.3;

export const callOpenRouter = async (
  messages,
  systemPrompt = NRI_TAX_SYSTEM_PROMPT,
  {
    preferredModel,
    maxTokens = AI_DEFAULT_MAX_TOKENS,
    temperature = AI_DEFAULT_TEMPERATURE,
    allowContinuation = true,
  } = {}
) => {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const normalizedMessages = normalizeChatMessages(messages);
  if (!normalizedMessages.length) {
    throw new Error("OpenRouter requires at least one user message");
  }

  let lastError = null;
  for (const model of buildOpenRouterModels(preferredModel)) {
    const { controller, timeoutId } = createTimeoutSignal(OPENROUTER_TIMEOUT_MS);

    try {
      console.log(`[AI] Trying OpenRouter model: ${model}`);

      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": OPENROUTER_REFERER,
          "X-Title": OPENROUTER_TITLE,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...normalizedMessages],
          max_tokens: Math.max(Number(maxTokens || 0), 2048),
          temperature,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw createHttpError("OpenRouter", response.status, errorText);
      }

      const data = await response.json();
      const choice = data?.choices?.[0];
      const answer = normalizeMessageContent(choice?.message?.content);

      if (!answer) {
        throw new Error("OpenRouter response did not include content");
      }

      if (needsContinuation(answer, choice?.finish_reason) && allowContinuation) {
        console.warn("[AI] OpenRouter response looks truncated. Requesting continuation.");
        const continuation = await callOpenRouter(
          buildContinuationMessages(normalizedMessages, answer),
          systemPrompt,
          {
            preferredModel: model,
            maxTokens,
            temperature,
            allowContinuation: false,
          }
        );

        return {
          response: mergeContinuation(answer, continuation.response),
          provider: "openrouter",
          model,
          finishReason: choice?.finish_reason || "continued",
        };
      }

      return {
        response: answer,
        provider: "openrouter",
        model,
        finishReason: choice?.finish_reason || "stop",
      };
    } catch (error) {
      console.error(`[AI] OpenRouter call failed for model ${model}:`, error.message);
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("OpenRouter failed without a specific error");
};

export const callGemini = async (
  messages,
  systemPrompt = NRI_TAX_SYSTEM_PROMPT,
  {
    maxTokens = AI_DEFAULT_MAX_TOKENS,
    temperature = AI_DEFAULT_TEMPERATURE,
    allowContinuation = true,
  } = {}
) => {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const normalizedMessages = normalizeChatMessages(messages);
  if (!normalizedMessages.length) {
    throw new Error("Gemini requires at least one user message");
  }

  const contents = normalizedMessages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const { controller, timeoutId } = createTimeoutSignal(GEMINI_TIMEOUT_MS);

  try {
    console.log(`[AI] Falling back to Gemini model: ${DEFAULT_GEMINI_MODEL}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: Math.max(Number(maxTokens || 0), 2048),
            temperature,
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw createHttpError("Gemini", response.status, errorText);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const answer = normalizeMessageContent(candidate?.content?.parts);
    const finishReason = String(candidate?.finishReason || "");

    if (!answer) {
      throw new Error("Gemini response did not include content");
    }

    if (needsContinuation(answer, finishReason) && allowContinuation) {
      console.warn("[AI] Gemini response looks truncated. Requesting continuation.");
      const continuation = await callGemini(buildContinuationMessages(normalizedMessages, answer), systemPrompt, {
        maxTokens,
        temperature,
        allowContinuation: false,
      });

      return {
        response: mergeContinuation(answer, continuation.response),
        provider: "gemini",
        model: DEFAULT_GEMINI_MODEL,
        finishReason: finishReason || "continued",
      };
    }

    return {
      response: answer,
      provider: "gemini",
      model: DEFAULT_GEMINI_MODEL,
      finishReason: finishReason || "STOP",
    };
  } catch (error) {
    console.error("[AI] Gemini call failed:", error.message);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const generateAIResponse = async (
  messages,
  systemPrompt = NRI_TAX_SYSTEM_PROMPT,
  { preferredModel, maxTokens = AI_DEFAULT_MAX_TOKENS, temperature = AI_DEFAULT_TEMPERATURE } = {}
) => {
  try {
    console.log("[AI] Trying OpenRouter first.");
    const result = await withRetry(
      () => callOpenRouter(messages, systemPrompt, { preferredModel, maxTokens, temperature }),
      2,
      "OpenRouter"
    );
    console.log("[AI] OpenRouter success.");
    return result;
  } catch (openRouterError) {
    console.error("[AI] OpenRouter failed after retries:", openRouterError.message);
  }

  try {
    console.log("[AI] Falling back to Gemini.");
    const result = await withRetry(
      () => callGemini(messages, systemPrompt, { maxTokens, temperature }),
      2,
      "Gemini"
    );
    console.log("[AI] Gemini success.");
    return result;
  } catch (geminiError) {
    console.error("[AI] Gemini failed after retries:", geminiError.message);
    throw new Error("All AI providers failed");
  }
};
