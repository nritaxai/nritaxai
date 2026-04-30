import {
  AI_DEFAULT_MAX_TOKENS,
  AI_DEFAULT_TEMPERATURE,
  NRI_TAX_SYSTEM_PROMPT,
  callGemini,
  generateAIResponse,
} from "../services/aiService.js";

// Ollama removed - using OpenRouter with Gemini fallback through the shared AI service.

export const generateGeminiResponse = async ({
  prompt,
  systemInstruction = NRI_TAX_SYSTEM_PROMPT,
  temperature = AI_DEFAULT_TEMPERATURE,
  maxOutputTokens = AI_DEFAULT_MAX_TOKENS,
}) => {
  const result = await callGemini([{ role: "user", content: String(prompt || "") }], systemInstruction, {
    temperature,
    maxTokens: maxOutputTokens,
  });

  return result.response;
};

export const generateChatResponse = async (
  userMessages,
  {
    systemPrompt = NRI_TAX_SYSTEM_PROMPT,
    model,
    temperature = AI_DEFAULT_TEMPERATURE,
    maxTokens = AI_DEFAULT_MAX_TOKENS,
  } = {}
) => {
  const result = await generateAIResponse(userMessages, systemPrompt, {
    preferredModel: model,
    temperature,
    maxTokens,
  });

  return result.response;
};
