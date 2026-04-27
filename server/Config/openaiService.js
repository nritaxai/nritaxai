import dotenv from "dotenv";

dotenv.config();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const DEFAULT_REFERER = process.env.OPENROUTER_SITE_URL || "https://nritax.ai";
const DEFAULT_TITLE = process.env.OPENROUTER_APP_NAME || "NRITAX AI";
const DEFAULT_TIMEOUT_MS = Math.max(Number(process.env.OPENROUTER_TIMEOUT_MS || 20000), 5000);
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const fallbackResponse = () =>
  "I can only answer NRI tax-related questions. For other topics, please consult another source.";

export const generateGeminiResponse = async ({
  prompt,
  systemInstruction,
  temperature = 0.1,
  maxOutputTokens = 900,
}) => {
  const geminiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!geminiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        systemInstruction: systemInstruction
          ? {
              parts: [{ text: systemInstruction }],
            }
          : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: String(prompt || "").slice(0, 12000) }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Gemini request failed with status ${response.status}`);
  }

  const json = await response.json();
  const content = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

  if (!content) {
    throw new Error("Gemini response did not include content");
  }

  return content;
};

export const generateChatResponse = async (
  userMessages,
  {
    systemPrompt = "You are an AI assistant specialized in NRI tax matters. Only answer questions related to NRI tax. If a question is unrelated, politely reply: 'I can only answer questions related to NRI tax.'",
    model = DEFAULT_OPENROUTER_MODEL,
    temperature = 0.1,
    maxTokens = 900,
    fallbackToGemini = true,
  } = {}
) => {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    if (!fallbackToGemini) {
      throw new Error("Missing OPENROUTER_API_KEY");
    }

    return generateGeminiResponse({
      prompt: userMessages.map((message) => `${message.role}: ${message.content}`).join("\n\n"),
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: maxTokens,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const messages = [{ role: "system", content: systemPrompt }, ...userMessages];

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": DEFAULT_REFERER,
        "X-Title": DEFAULT_TITLE,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "OpenRouter API error");
    }

    const json = await response.json();
    const answer = String(json?.choices?.[0]?.message?.content || "").trim();

    if (!answer) {
      throw new Error("OpenRouter response did not include content");
    }

    if (answer.includes("I can only answer questions related to NRI tax")) {
      return fallbackResponse();
    }

    return answer;
  } catch (error) {
    if (!fallbackToGemini) {
      throw error;
    }

    console.error("OpenRouter Error:", error instanceof Error ? error.message : error);
    try {
      return await generateGeminiResponse({
        prompt: userMessages.map((message) => `${message.role}: ${message.content}`).join("\n\n"),
        systemInstruction: systemPrompt,
        temperature,
        maxOutputTokens: maxTokens,
      });
    } catch (geminiError) {
      console.error("Gemini Fallback Error:", geminiError instanceof Error ? geminiError.message : geminiError);
      return fallbackResponse();
    }
  } finally {
    clearTimeout(timeoutId);
  }
};
