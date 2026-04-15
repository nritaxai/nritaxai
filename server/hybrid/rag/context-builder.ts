import type { KnowledgeChunkRecord } from "../db/mongodb";

export type BuiltContext = {
  contextText: string;
  citations: Array<{
    source: string;
    title?: string;
    section?: string;
    page?: number;
    score: number;
  }>;
  confidence: number;
  chunkCount: number;
  hasSufficientContext: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const roundScore = (value: number) => Number(value.toFixed(3));

export const computeRetrievalConfidence = (chunks: KnowledgeChunkRecord[]): number => {
  if (!chunks.length) {
    return 0;
  }

  const normalizedScores = chunks
    .map((chunk) => Number(chunk.score || 0))
    .filter((score) => Number.isFinite(score))
    .map((score) => clamp(score, 0, 1));

  if (!normalizedScores.length) {
    return 0;
  }

  const averageScore =
    normalizedScores.reduce((total, score) => total + score, 0) / normalizedScores.length;

  const bestScore = Math.max(...normalizedScores);
  const coverageBoost = Math.min(chunks.length / 5, 1) * 0.08;

  return roundScore(clamp(averageScore * 0.55 + bestScore * 0.37 + coverageBoost, 0, 1));
};

export const buildContext = (chunks: KnowledgeChunkRecord[]): BuiltContext => {
  const confidence = computeRetrievalConfidence(chunks);
  const citations = chunks.map((chunk) => ({
    source: String(chunk.metadata?.source || "unknown"),
    title: typeof chunk.metadata?.documentTitle === "string" ? chunk.metadata.documentTitle : undefined,
    section: typeof chunk.metadata?.section === "string" ? chunk.metadata.section : undefined,
    page: typeof chunk.metadata?.page === "number" ? chunk.metadata.page : undefined,
    score: roundScore(Number(chunk.score || 0)),
  }));

  const contextText = chunks
    .map((chunk, index) => {
      const label = `Source ${index + 1}`;
      const title = citations[index]?.title ? ` | Title: ${citations[index].title}` : "";
      const section = citations[index]?.section ? ` | Section: ${citations[index].section}` : "";
      const page =
        typeof citations[index]?.page === "number" ? ` | Page: ${String(citations[index].page)}` : "";

      return `[${label}] ${citations[index]?.source}${title}${section}${page}\n${chunk.content.trim()}`;
    })
    .join("\n\n");

  return {
    contextText,
    citations,
    confidence,
    chunkCount: chunks.length,
    hasSufficientContext: chunks.length > 0 && confidence >= Number(process.env.HYBRID_MIN_CONFIDENCE || 0.7),
  };
};
