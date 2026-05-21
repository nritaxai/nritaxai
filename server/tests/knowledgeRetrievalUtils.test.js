import test from "node:test";
import assert from "node:assert/strict";

import {
  buildContextForPrompt,
  buildMetadataBoost,
  buildSourceAttributions,
  chunkTextWithMetadata,
  computeRetrievalConfidence,
  extractQuerySignals,
  filterDuplicateChunks,
  parseDocumentMetadata,
} from "../services/knowledgeRetrievalUtils.js";

test("parseDocumentMetadata extracts DTAA and tax-law fields", () => {
  const metadata = parseDocumentMetadata({
    fileName: "India-USA DTAA.pdf",
    text: "Article 12 covers royalty income. Section 90 applies for FY 2024-25 between India and United States.",
  });

  assert.deepEqual(metadata.country, ["INDIA", "USA"]);
  assert.equal(metadata.article, "12");
  assert.equal(metadata.section, "90");
  assert.equal(metadata.financialYear, "2024-25");
  assert.equal(metadata.taxType, "royalty");
});

test("chunkTextWithMetadata preserves overlap metadata across chunks", () => {
  const text = Array.from({ length: 120 }, (_, index) => `Sentence ${index + 1}.`).join(" ");
  const chunks = chunkTextWithMetadata(text, { size: 250, overlap: 40 });

  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].overlapChars, 0);
  assert.ok(chunks[1].overlapChars > 0);
  assert.ok(chunks.every((chunk) => chunk.endOffset > chunk.startOffset));
});

test("filterDuplicateChunks removes exact and near-duplicate rows", () => {
  const rows = [
    { text: "Article 12 applies to royalty income from India to USA." },
    { text: "Article 12 applies to royalty income from India to USA." },
    { text: "Article 12 applies to royalty income from India to the USA" },
    { text: "Section 90 provides treaty relief for non residents." },
  ];

  const result = filterDuplicateChunks(rows, 0.8);

  assert.equal(result.chunks.length, 2);
  assert.equal(result.duplicateCount, 2);
});

test("query signals and metadata boost prioritize treaty-specific matches", () => {
  const signals = extractQuerySignals("What does Article 12 of the India USA DTAA say about royalty income for FY 2024-25?", {
    currentCountry: "India",
    relevantCountry: "USA",
  });

  const boost = buildMetadataBoost(
    {
      sourceType: "dtaa_pdf",
      metadata: {
        country: ["INDIA", "USA"],
        article: "12",
        section: "",
        financialYear: "2024-25",
        taxType: "royalty",
      },
    },
    signals
  );

  assert.ok(boost >= 0.4);
});

test("buildSourceAttributions and retrieval confidence package grounded citations", () => {
  const ranked = [
    {
      fileName: "India-USA DTAA.pdf",
      page: 4,
      sourceType: "dtaa_pdf",
      text: "Article 12 taxes royalties in the source state subject to treaty limits.",
      retrievalScore: 0.81,
      chunkConfidence: 0.84,
      retrievalBreakdown: { semantic: 0.7, lexical: 0.6, metadataBoost: 0.22, score: 0.81 },
      metadata: {
        country: ["INDIA", "USA"],
        article: "12",
        section: "",
        financialYear: "2024-25",
        taxType: "royalty",
        sourceReference: "India-USA DTAA.pdf#page=4",
      },
    },
    {
      fileName: "Income Tax Act.pdf",
      page: 19,
      sourceType: "tax_law",
      text: "Section 90 enables relief where a DTAA applies.",
      retrievalScore: 0.66,
      chunkConfidence: 0.71,
      retrievalBreakdown: { semantic: 0.55, lexical: 0.44, metadataBoost: 0.18, score: 0.66 },
      metadata: {
        country: ["INDIA"],
        article: "",
        section: "90",
        financialYear: "",
        taxType: "general_tax",
        sourceReference: "Income Tax Act.pdf#page=19",
      },
    },
  ];

  const sources = buildSourceAttributions(ranked);
  const context = buildContextForPrompt(ranked);
  const confidence = computeRetrievalConfidence(ranked);

  assert.equal(sources[0].citation, "Source 1");
  assert.match(context, /\[Source 1\]/);
  assert.ok(confidence > 0.7);
});
