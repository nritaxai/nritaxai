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

const roundScore = (value: number) => Number(value.toFixed(3));
export const buildContext = (chunks: KnowledgeChunkRecord[], confidence: number): BuiltContext => {
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
