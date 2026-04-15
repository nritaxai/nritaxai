import { vectorSearchKnowledge, type KnowledgeChunkRecord } from "../db/mongodb";

export type RetrievalResult = {
  chunks: KnowledgeChunkRecord[];
  topScore: number;
};

export class HybridRetriever {
  async search(queryEmbedding: number[], limit?: number): Promise<RetrievalResult> {
    const chunks = await vectorSearchKnowledge({
      queryVector: queryEmbedding,
      limit: Math.min(Math.max(limit || Number(process.env.HYBRID_TOP_K || 5), 1), 8),
      numCandidates: Number(process.env.HYBRID_NUM_CANDIDATES || 100),
      minScore: Number(process.env.HYBRID_MIN_VECTOR_SCORE || 0),
    });

    return {
      chunks,
      topScore: Number(chunks[0]?.score || 0),
    };
  }
}
