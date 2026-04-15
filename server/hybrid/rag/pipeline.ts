import { OllamaClient } from "../llm/ollama.client";
import { buildContext, type BuiltContext } from "./context-builder";
import { HybridRetriever } from "./retriever";

export type RagPipelineResult = BuiltContext & {
  queryEmbedding: number[];
};

export class RagPipeline {
  private readonly ollamaClient: OllamaClient;
  private readonly retriever: HybridRetriever;

  constructor() {
    this.ollamaClient = new OllamaClient();
    this.retriever = new HybridRetriever();
  }

  async run(query: string): Promise<RagPipelineResult> {
    const normalizedQuery = query.replace(/\s+/g, " ").trim();
    const embeddingResult = await this.ollamaClient.embed(normalizedQuery);
    const retrievalResult = await this.retriever.search(embeddingResult.embedding);
    const builtContext = buildContext(retrievalResult.chunks, retrievalResult.confidence);

    return {
      ...builtContext,
      queryEmbedding: embeddingResult.embedding,
    };
  }
}
