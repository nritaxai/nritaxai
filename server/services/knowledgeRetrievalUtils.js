import crypto from "crypto";

const DEFAULT_CHUNK_SIZE = Math.max(Number(process.env.PDF_CHUNK_SIZE || 900), 250);
const DEFAULT_CHUNK_OVERLAP = Math.max(Number(process.env.PDF_CHUNK_OVERLAP || 180), 0);
const MAX_OVERLAP_RATIO = 0.35;

const COUNTRY_ALIASES = new Map([
  ["INDIA", "INDIA"],
  ["UNITED STATES", "USA"],
  ["US", "USA"],
  ["USA", "USA"],
  ["U.S.", "USA"],
  ["UNITED KINGDOM", "UK"],
  ["UK", "UK"],
  ["U.K.", "UK"],
  ["UAE", "UAE"],
  ["UNITED ARAB EMIRATES", "UAE"],
  ["SINGAPORE", "SINGAPORE"],
  ["CANADA", "CANADA"],
  ["AUSTRALIA", "AUSTRALIA"],
  ["INDONESIA", "INDONESIA"],
  ["MALAYSIA", "MALAYSIA"],
]);

export const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeUpperToken = (value = "") => sanitizeString(value).toUpperCase();

const normalizeCountry = (value = "") => COUNTRY_ALIASES.get(normalizeUpperToken(value)) || normalizeUpperToken(value);

export const tokenize = (text = "") =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);

export const normalizeChunkFingerprint = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .slice(0, 400);

export const hashNormalizedText = (value = "") =>
  crypto.createHash("sha256").update(normalizeChunkFingerprint(value)).digest("hex");

const uniqueStrings = (values = []) => Array.from(new Set(values.map((value) => sanitizeString(value)).filter(Boolean)));

export const inferTaxType = (value = "") => {
  const source = String(value || "");

  if (/\bcapital gains?\b/i.test(source)) return "capital_gains";
  if (/\bdividend\b/i.test(source)) return "dividend";
  if (/\binterest\b/i.test(source)) return "interest";
  if (/\brent(al)?\b/i.test(source)) return "rental_income";
  if (/\bsalary\b/i.test(source)) return "salary";
  if (/\broyalt(y|ies)\b/i.test(source)) return "royalty";
  if (/\bfees? for technical services\b|\bfts\b/i.test(source)) return "fees_for_technical_services";
  if (/\btds\b|\bwithholding\b/i.test(source)) return "withholding";
  return "general_tax";
};

export const parseDocumentMetadata = ({ fileName = "", text = "" } = {}) => {
  const source = `${sanitizeString(fileName)} ${sanitizeString(text).slice(0, 1200)}`;
  const countryMatches = Array.from(
    source.matchAll(
      /\b(?:INDIA|USA|US|U\.S\.|UNITED STATES|UK|U\.K\.|UNITED KINGDOM|UAE|UNITED ARAB EMIRATES|SINGAPORE|CANADA|AUSTRALIA|INDONESIA|MALAYSIA)\b/gi
    )
  ).map((match) => normalizeCountry(match[0]));
  const articleMatches = Array.from(source.matchAll(/\bArticle\s+(\d+[A-Z]?)\b/gi)).map((match) => match[1].toUpperCase());
  const sectionMatches = Array.from(source.matchAll(/\bSection\s+(\d+[A-Z]?)\b/gi)).map((match) => match[1].toUpperCase());
  const financialYearMatch = source.match(
    /\b(?:FY|AY|Financial Year|Assessment Year)\s*[-:]?\s*(\d{4}(?:-\d{2,4})?)\b/i
  );

  return {
    country: uniqueStrings(countryMatches).slice(0, 6),
    article: sanitizeString(articleMatches[0] || ""),
    articleList: uniqueStrings(articleMatches).slice(0, 8),
    section: sanitizeString(sectionMatches[0] || ""),
    sectionList: uniqueStrings(sectionMatches).slice(0, 8),
    financialYear: sanitizeString(financialYearMatch?.[1] || ""),
    taxType: inferTaxType(source),
  };
};

const calculateAdaptiveOverlap = (normalizedText, chunkSize, defaultOverlap) => {
  const paragraphCount = Math.max((normalizedText.match(/\.\s+[A-Z]/g) || []).length, 1);
  const densityFactor = Math.min(paragraphCount / 18, 1);
  const adaptive = Math.round(chunkSize * (0.16 + densityFactor * 0.08));
  return Math.min(Math.max(defaultOverlap, adaptive), Math.floor(chunkSize * MAX_OVERLAP_RATIO));
};

export const chunkTextWithMetadata = (
  text,
  {
    size = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_CHUNK_OVERLAP,
  } = {}
) => {
  const safeSize = Math.max(Number(size || DEFAULT_CHUNK_SIZE), 250);
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalizedText) return [];

  const safeOverlap = calculateAdaptiveOverlap(normalizedText, safeSize, Math.min(Number(overlap || 0), safeSize - 1));
  const chunks = [];
  let start = 0;

  while (start < normalizedText.length) {
    const targetEnd = Math.min(start + safeSize, normalizedText.length);
    let end = targetEnd;

    if (targetEnd < normalizedText.length) {
      const boundarySlice = normalizedText.slice(start, Math.min(targetEnd + 120, normalizedText.length));
      const sentenceBreak = Math.max(
        boundarySlice.lastIndexOf(". "),
        boundarySlice.lastIndexOf("; "),
        boundarySlice.lastIndexOf(": "),
        boundarySlice.lastIndexOf(") ")
      );
      if (sentenceBreak > Math.floor(safeSize * 0.6)) {
        end = start + sentenceBreak + 1;
      }
    }

    const chunk = normalizedText.slice(start, end).trim();
    if (chunk) {
      chunks.push({
        text: chunk,
        startOffset: start,
        endOffset: end,
        overlapChars: chunks.length === 0 ? 0 : safeOverlap,
        dedupeHash: hashNormalizedText(chunk),
      });
    }

    if (end >= normalizedText.length) break;
    start = Math.max(end - safeOverlap, start + 1);
  }

  return chunks;
};

const jaccardSimilarity = (leftTokens = [], rightTokens = []) => {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) intersection += 1;
  });
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
};

export const filterDuplicateChunks = (rows = [], nearDuplicateThreshold = Number(process.env.KNOWLEDGE_NEAR_DUPLICATE_THRESHOLD || 0.92)) => {
  const unique = [];
  const exactFingerprints = new Set();
  const exactHashes = new Set();
  let duplicateCount = 0;

  rows.forEach((row) => {
    const text = sanitizeString(row?.text);
    if (!text) return;

    const fingerprint = normalizeChunkFingerprint(text);
    const dedupeHash = sanitizeString(row?.dedupeHash) || hashNormalizedText(text);
    if (!fingerprint || exactFingerprints.has(fingerprint) || exactHashes.has(dedupeHash)) {
      duplicateCount += 1;
      return;
    }

    const candidateTokens = tokenize(text);
    const isNearDuplicate = unique.some((existing) => {
      const sizeDelta = Math.abs((existing.text?.length || 0) - text.length);
      if (sizeDelta > 60) return false;
      return jaccardSimilarity(tokenize(existing.text), candidateTokens) >= nearDuplicateThreshold;
    });

    if (isNearDuplicate) {
      duplicateCount += 1;
      return;
    }

    exactFingerprints.add(fingerprint);
    exactHashes.add(dedupeHash);
    unique.push({
      ...row,
      dedupeHash,
    });
  });

  return {
    chunks: unique,
    duplicateCount,
  };
};

export const cosineSimilarity = (left = [], right = []) => {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index] || 0);
    const b = Number(right[index] || 0);
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

export const lexicalScore = (query = "", candidate = "") => {
  const queryTokens = new Set(tokenize(query));
  if (!queryTokens.size) return 0;
  const candidateTokens = new Set(tokenize(candidate));
  let overlap = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(queryTokens.size, 1);
};

export const extractQuerySignals = (query = "", context = {}) => {
  const parsed = parseDocumentMetadata({ text: query });
  const contextCountry = [context?.currentCountry, context?.relevantCountry].map(normalizeCountry).filter(Boolean);
  const contextFinancialYear = sanitizeString(context?.financialYear);
  const contextTaxType = inferTaxType(`${context?.incomeType || ""} ${query}`);

  return {
    countries: uniqueStrings([...parsed.country, ...contextCountry]),
    article: sanitizeString(parsed.article || ""),
    section: sanitizeString(parsed.section || ""),
    financialYear: contextFinancialYear || sanitizeString(parsed.financialYear || ""),
    taxType: contextTaxType !== "general_tax" ? contextTaxType : parsed.taxType,
    queryTerms: tokenize(query),
  };
};

export const buildMetadataBoost = (chunk = {}, signals = {}) => {
  let boost = 0;
  const chunkCountries = Array.isArray(chunk.metadata?.country) ? chunk.metadata.country.map(normalizeCountry) : [];
  const countries = Array.isArray(signals.countries) ? signals.countries.map(normalizeCountry) : [];
  const chunkArticle = sanitizeString(chunk.metadata?.article).toUpperCase();
  const chunkSection = sanitizeString(chunk.metadata?.section).toUpperCase();
  const chunkFinancialYear = sanitizeString(chunk.metadata?.financialYear).toUpperCase();
  const chunkTaxType = sanitizeString(chunk.metadata?.taxType).toLowerCase();
  const signalArticle = sanitizeString(signals.article).toUpperCase();
  const signalSection = sanitizeString(signals.section).toUpperCase();
  const signalFinancialYear = sanitizeString(signals.financialYear).toUpperCase();
  const signalTaxType = sanitizeString(signals.taxType).toLowerCase();

  if (countries.some((country) => chunkCountries.includes(country))) boost += 0.14;
  if (signalArticle && chunkArticle && signalArticle === chunkArticle) boost += 0.18;
  if (signalSection && chunkSection && signalSection === chunkSection) boost += 0.18;
  if (signalFinancialYear && chunkFinancialYear && signalFinancialYear === chunkFinancialYear) boost += 0.1;
  if (signalTaxType && chunkTaxType && signalTaxType === chunkTaxType) boost += 0.08;
  if (sanitizeString(chunk.sourceType) === "dtaa_pdf" && countries.length > 0) boost += 0.04;
  if (sanitizeString(chunk.sourceType) === "tax_law" && (signalSection || signalFinancialYear)) boost += 0.04;

  return Number(boost.toFixed(4));
};

export const computeRetrievalScore = ({ semantic = 0, lexical = 0, metadataBoost = 0, sourceRecencyBoost = 0 }) =>
  Number((semantic * 0.56 + lexical * 0.24 + metadataBoost + sourceRecencyBoost).toFixed(4));

export const buildRetrievalBreakdown = ({ semantic = 0, lexical = 0, metadataBoost = 0, score = 0 }) => ({
  semantic: Number(semantic.toFixed(4)),
  lexical: Number(lexical.toFixed(4)),
  metadataBoost: Number(metadataBoost.toFixed(4)),
  score: Number(score.toFixed(4)),
});

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const computeChunkConfidence = ({ semantic = 0, lexical = 0, metadataBoost = 0, score = 0 }) =>
  Number(clamp(score * 0.7 + semantic * 0.2 + lexical * 0.1 + Math.min(metadataBoost, 0.2), 0, 1).toFixed(3));

export const computeRetrievalConfidence = (ranked = []) => {
  if (!ranked.length) return 0;
  const top = ranked.slice(0, 3);
  const average = top.reduce((sum, chunk) => sum + Number(chunk.chunkConfidence || 0), 0) / top.length;
  const best = Math.max(...top.map((chunk) => Number(chunk.chunkConfidence || 0)));
  const diversityBonus = new Set(top.map((chunk) => `${chunk.fileName}:${chunk.page}`)).size > 1 ? 0.03 : 0;
  return Number(clamp(best * 0.58 + average * 0.39 + diversityBonus, 0, 1).toFixed(3));
};

export const buildSourceAttributions = (ranked = []) =>
  ranked.map((chunk, index) => {
    const citation = `Source ${index + 1}`;
    const article = sanitizeString(chunk.metadata?.article);
    const section = sanitizeString(chunk.metadata?.section);
    const financialYear = sanitizeString(chunk.metadata?.financialYear);
    const taxType = sanitizeString(chunk.metadata?.taxType);
    const descriptor = [article ? `Article ${article}` : "", section ? `Section ${section}` : "", financialYear ? `FY ${financialYear}` : "", taxType || ""]
      .filter(Boolean)
      .join(" | ");

    return {
      citation,
      fileName: chunk.fileName,
      page: chunk.page,
      sourceType: chunk.sourceType,
      score: Number(chunk.retrievalScore || 0),
      confidence: Number(chunk.chunkConfidence || 0),
      excerpt: sanitizeString(chunk.text).slice(0, 380),
      metadata: {
        country: Array.isArray(chunk.metadata?.country) ? chunk.metadata.country : [],
        article,
        section,
        financialYear,
        taxType,
      },
      sourceReference: chunk.metadata?.sourceReference || `${chunk.fileName}#page=${chunk.page}`,
      sourceUrl: sanitizeString(chunk.metadata?.sourceUrl),
      descriptor,
      retrieval: chunk.retrievalBreakdown || {},
    };
  });

export const buildContextForPrompt = (ranked = []) =>
  ranked
    .map((chunk, index) => {
      const citation = `Source ${index + 1}`;
      const article = sanitizeString(chunk.metadata?.article);
      const section = sanitizeString(chunk.metadata?.section);
      const taxType = sanitizeString(chunk.metadata?.taxType);
      const tags = [
        chunk.fileName ? `${chunk.fileName} p.${chunk.page}` : "",
        article ? `Article ${article}` : "",
        section ? `Section ${section}` : "",
        taxType || "",
      ]
        .filter(Boolean)
        .join(" | ");
      return `[${citation}] ${tags}\n${sanitizeString(chunk.text)}`;
    })
    .join("\n\n");
