import { vectorSearchKnowledge, type KnowledgeChunkRecord } from "../db/mongodb";
import { featureFlags } from "../../Config/featureFlags.js";

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

const RETRIEVAL_CACHE_TTL_MS = Math.max(Number(process.env.HYBRID_RETRIEVAL_CACHE_TTL_MS || 90000), 1000);
const RETRIEVAL_CACHE_MAX_ITEMS = Math.max(Number(process.env.HYBRID_RETRIEVAL_CACHE_MAX_ITEMS || 250), 25);
const retrievalCache = new Map<string, { createdAt: number; result: RetrievalResult }>();

const buildRetrievalCacheKey = (queryEmbedding: number[], limit: number) =>
  `${limit}:${queryEmbedding.slice(0, 12).map((value) => Number(value).toFixed(4)).join(",")}`;

const getCachedRetrieval = (cacheKey: string): RetrievalResult | null => {
  const entry = retrievalCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > RETRIEVAL_CACHE_TTL_MS) {
    retrievalCache.delete(cacheKey);
    return null;
  }
  return entry.result;
};

const setCachedRetrieval = (cacheKey: string, result: RetrievalResult) => {
  retrievalCache.set(cacheKey, { createdAt: Date.now(), result });
  while (retrievalCache.size > RETRIEVAL_CACHE_MAX_ITEMS) {
    const oldestKey = retrievalCache.keys().next().value;
    if (!oldestKey) break;
    retrievalCache.delete(oldestKey);
  }
};

const tokenize = (text: string): string[] =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);

const rerankByKeywordOverlap = (chunks: KnowledgeChunkRecord[], queryTerms: string[]): KnowledgeChunkRecord[] => {
  if (!queryTerms.length) return chunks;

  const querySet = new Set(queryTerms);

  return [...chunks].sort((left, right) => {
    const leftTokens = new Set(tokenize(left.content));
    const rightTokens = new Set(tokenize(right.content));
    let leftOverlap = 0;
    let rightOverlap = 0;

    querySet.forEach((term) => {
      if (leftTokens.has(term)) leftOverlap += 1;
      if (rightTokens.has(term)) rightOverlap += 1;
    });

    const leftScore = Number(left.score || 0) + leftOverlap * 0.02;
    const rightScore = Number(right.score || 0) + rightOverlap * 0.02;
    return rightScore - leftScore;
  });
};

export class HybridRetriever {
  async search(queryEmbedding: number[], limit?: number, queryText = ""): Promise<RetrievalResult> {
    const safeLimit = Math.min(Math.max(limit || Number(process.env.HYBRID_TOP_K || 5), 1), 8);
    const cacheKey = buildRetrievalCacheKey(queryEmbedding, safeLimit);

    if (featureFlags.hybridRetrievalCacheEnabled) {
      const cached = getCachedRetrieval(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const results = await vectorSearchKnowledge({
      queryVector: queryEmbedding,
      limit: safeLimit,
      numCandidates: Number(process.env.HYBRID_NUM_CANDIDATES || 100),
      minScore: Number(process.env.HYBRID_MIN_VECTOR_SCORE || 0),
    });

    const chunks = rerankByKeywordOverlap(Array.isArray(results) ? results : [], tokenize(queryText)).slice(0, safeLimit);
    const confidence = chunks.length > 0 ? computeConfidence(chunks) : 0;
    const retrievalResult = {
      chunks,
      confidence,
    };

    if (featureFlags.hybridRetrievalCacheEnabled) {
      setCachedRetrieval(cacheKey, retrievalResult);
    }

    return retrievalResult;
  }
}
