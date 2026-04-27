import pdf from "pdf-parse";
import { upsertKnowledgeChunks, type KnowledgeChunkMetadata, type KnowledgeChunkRecord } from "../db/mongodb";
import { HybridProviderClient } from "../llm/provider";

export type IngestDocumentInput = {
  source: string;
  title: string;
  text?: string;
  pdfBuffer?: Buffer;
  metadata?: Omit<KnowledgeChunkMetadata, "source" | "documentTitle">;
};

export type IngestResult = {
  processedDocuments: number;
  storedChunks: number;
};

const normalizeText = (text: string) => {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
};

const chunkText = (text: string, chunkSize = 850, overlap = 120): string[] => {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const slice = text.slice(cursor, cursor + chunkSize);
    const breakIndex = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
    const endIndex = breakIndex > 250 ? cursor + breakIndex + 1 : cursor + chunkSize;
    const chunk = text.slice(cursor, endIndex).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    cursor = Math.max(endIndex - overlap, cursor + 1);
  }

  return chunks;
};

const extractDocumentText = async (input: IngestDocumentInput): Promise<string> => {
  if (typeof input.text === "string" && input.text.trim()) {
    return normalizeText(input.text);
  }

  if (input.pdfBuffer) {
    const parsed = await pdf(input.pdfBuffer);
    return normalizeText(String(parsed.text || ""));
  }

  throw new Error(`Document ${input.source} does not contain text or a PDF buffer`);
};

export class KnowledgeIngestService {
  private readonly providerClient: HybridProviderClient;

  constructor() {
    this.providerClient = new HybridProviderClient();
  }

  async ingestDocuments(documents: IngestDocumentInput[]): Promise<IngestResult> {
    let storedChunks = 0;

    for (const document of documents) {
      const text = await extractDocumentText(document);
      const chunkedText = chunkText(text);

      const records: KnowledgeChunkRecord[] = [];
      for (let index = 0; index < chunkedText.length; index += 1) {
        const content = chunkedText[index];
        const embedding = await this.providerClient.embed(content);

        records.push({
          content,
          embedding: embedding.embedding,
          metadata: {
            source: document.source,
            documentTitle: document.title,
            chunkIndex: index,
            ...document.metadata,
          },
        });
      }

      storedChunks += await upsertKnowledgeChunks(records);
    }

    return {
      processedDocuments: documents.length,
      storedChunks,
    };
  }
}
