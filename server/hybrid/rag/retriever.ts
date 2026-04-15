import { vectorSearchKnowledge, type KnowledgeChunkRecord } from "../db/mongodb";

export type RetrievalResult = {
  chunks: KnowledgeChunkRecord[];
  confidence: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeVectorScore = (score: number): number => {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return clamp(score, 0, 1);
};

const computeConfidence = (chunks: KnowledgeChunkRecord[]): number => {
  if (!chunks.length) {
    return 0;
  }

  const normalizedScores = chunks.map((chunk) => normalizeVectorScore(Number(chunk.score || 0)));
  const averageScore =
    normalizedScores.reduce((total, score) => total + score, 0) / normalizedScores.length;
  const bestScore = Math.max(...normalizedScores);

  return Number(clamp(bestScore * 0.6 + averageScore * 0.4, 0, 1).toFixed(3));
};

export class HybridRetriever {
  async search(queryEmbedding: number[], limit?: number): Promise<RetrievalResult> {
    const results = await vectorSearchKnowledge({
      queryVector: queryEmbedding,
      limit: Math.min(Math.max(limit || Number(process.env.HYBRID_TOP_K || 5), 1), 8),
      numCandidates: Number(process.env.HYBRID_NUM_CANDIDATES || 100),
      minScore: Number(process.env.HYBRID_MIN_VECTOR_SCORE || 0),
    });

    const chunks = Array.isArray(results) ? results : [];
    const confidence = chunks.length > 0 ? computeConfidence(chunks) : 0;

    return {
      chunks,
      confidence,
    };
  }
}
