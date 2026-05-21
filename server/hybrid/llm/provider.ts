import { GeminiClient } from "./gemini.client";
import { OllamaClient } from "./ollama.client";
import { OpenRouterClient } from "./openrouter.client";

export class HybridProviderClient {
  private readonly openRouterClient: OpenRouterClient;
  private readonly geminiClient: GeminiClient;
  private readonly ollamaClient: OllamaClient;

  constructor() {
    this.openRouterClient = new OpenRouterClient();
    this.geminiClient = new GeminiClient();
    this.ollamaClient = new OllamaClient();
  }

  async embed(text: string) {
    return this.geminiClient.embed(text);
  }

  async generateWithOpenRouter(systemPrompt: string, prompt: string) {
    return this.openRouterClient.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      {
        temperature: 0.1,
        maxTokens: 900,
      }
    );
  }

  async generateWithGemini(systemPrompt: string, prompt: string) {
    return this.geminiClient.generate({
      systemInstruction: systemPrompt,
      prompt,
      temperature: 0.1,
      maxOutputTokens: 900,
    });
  }

  async generateWithOllama(systemPrompt: string, prompt: string) {
    return this.ollamaClient.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      {
        temperature: 0.1,
        maxTokens: 900,
      }
    );
  }
}
