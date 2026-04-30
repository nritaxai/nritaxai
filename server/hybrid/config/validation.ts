/**
 * Hybrid System Environment Configuration Validation
 * Ensures all required environment variables are present and valid
 */

interface ValidationError {
  variable: string;
  reason: string;
}

const validationErrors: ValidationError[] = [];

const validateRequiredEnv = (variable: string, fallback?: string): string => {
  const value = String(process.env[variable] || fallback || "").trim();

  if (!value) {
    validationErrors.push({
      variable,
      reason: `Missing required environment variable: ${variable}`,
    });
    return "";
  }

  return value;
};

const validateOptionalEnv = (variable: string, fallback: string): string => {
  return String(process.env[variable] || fallback).trim();
};

export const validateHybridConfig = (): void => {
  validateRequiredEnv("OPENROUTER_API_KEY");
  validateRequiredEnv("GEMINI_API_KEY");
  validateRequiredEnv("MONGO_URI");

  validateOptionalEnv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet");
  validateOptionalEnv("GEMINI_MODEL", "gemini-1.5-pro");
  validateOptionalEnv("GEMINI_EMBED_MODEL", "text-embedding-004");

  validateOptionalEnv("OPENROUTER_TIMEOUT_MS", "20000");
  validateOptionalEnv("HYBRID_GEMINI_TIMEOUT_MS", "2800");
  validateOptionalEnv("HYBRID_GEMINI_EMBED_TIMEOUT_MS", "4000");

  validateOptionalEnv("HYBRID_TOP_K", "5");
  validateOptionalEnv("HYBRID_NUM_CANDIDATES", "100");
  validateOptionalEnv("HYBRID_MIN_VECTOR_SCORE", "0");
  validateOptionalEnv("HYBRID_MIN_CONFIDENCE", "0.7");

  validateOptionalEnv("HYBRID_MONGO_MAX_POOL_SIZE", "10");
  validateOptionalEnv("HYBRID_MONGO_MIN_POOL_SIZE", "1");
  validateOptionalEnv("HYBRID_MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000");
  validateOptionalEnv("HYBRID_MONGO_SOCKET_TIMEOUT_MS", "15000");

  validateOptionalEnv("HYBRID_KNOWLEDGE_COLLECTION", "knowledge_chunks");
  validateOptionalEnv("HYBRID_VECTOR_INDEX", "vector_index");

  if (validationErrors.length > 0) {
    console.error("HYBRID SYSTEM CONFIGURATION ERRORS:");
    validationErrors.forEach((error) => {
      console.error(`   - ${error.variable}: ${error.reason}`);
    });

    throw new Error(
      `Hybrid system configuration validation failed: ${validationErrors.length} error(s) found`
    );
  }

  console.log("Hybrid system configuration validated successfully");
};

export const printHybridConfig = (): void => {
  console.log("\nHYBRID SYSTEM CONFIGURATION:");
  console.log("  API Keys:");
  console.log(`    - OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? "Set" : "Missing"}`);
  console.log(`    - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "Set" : "Missing"}`);
  console.log(`    - MONGO_URI: ${process.env.MONGO_URI ? "Set" : "Missing"}`);
  console.log("  LLM Models:");
  console.log(`    - OpenRouter Model: ${validateOptionalEnv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")}`);
  console.log(`    - Gemini Model: ${validateOptionalEnv("GEMINI_MODEL", "gemini-1.5-pro")}`);
  console.log(`    - Gemini Embedding Model: ${validateOptionalEnv("GEMINI_EMBED_MODEL", "text-embedding-004")}`);
  console.log("  Timeouts:");
  console.log(`    - OpenRouter: ${validateOptionalEnv("OPENROUTER_TIMEOUT_MS", "20000")}ms`);
  console.log(`    - Gemini: ${validateOptionalEnv("HYBRID_GEMINI_TIMEOUT_MS", "2800")}ms`);
  console.log(`    - Gemini Embed: ${validateOptionalEnv("HYBRID_GEMINI_EMBED_TIMEOUT_MS", "4000")}ms`);
  console.log("  RAG Settings:");
  console.log(`    - Top K: ${validateOptionalEnv("HYBRID_TOP_K", "5")}`);
  console.log(`    - Num Candidates: ${validateOptionalEnv("HYBRID_NUM_CANDIDATES", "100")}`);
  console.log(`    - Min Confidence: ${validateOptionalEnv("HYBRID_MIN_CONFIDENCE", "0.7")}`);
  console.log("");
};
