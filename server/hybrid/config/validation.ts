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

/**
 * Validates all environments needed for hybrid chat system
 */
export const validateHybridConfig = (): void => {
  // Core API keys
  validateRequiredEnv("GEMINI_API_KEY");
  validateRequiredEnv("MONGO_URI");

  // Optional with defaults
  validateOptionalEnv("OLLAMA_BASE_URL", "http://localhost:11434");
  validateOptionalEnv("OLLAMA_CHAT_MODEL", "gemma");
  validateOptionalEnv("OLLAMA_EMBED_MODEL", "nomic-embed-text");

  // Timeouts
  validateOptionalEnv("HYBRID_OLLAMA_CHAT_TIMEOUT_MS", "3000");
  validateOptionalEnv("HYBRID_OLLAMA_EMBED_TIMEOUT_MS", "1200");
  validateOptionalEnv("HYBRID_GEMINI_TIMEOUT_MS", "2800");

  // RAG Config
  validateOptionalEnv("HYBRID_TOP_K", "5");
  validateOptionalEnv("HYBRID_NUM_CANDIDATES", "100");
  validateOptionalEnv("HYBRID_MIN_VECTOR_SCORE", "0");
  validateOptionalEnv("HYBRID_MIN_CONFIDENCE", "0.7");

  // MongoDB Config
  validateOptionalEnv("HYBRID_MONGO_MAX_POOL_SIZE", "10");
  validateOptionalEnv("HYBRID_MONGO_MIN_POOL_SIZE", "1");
  validateOptionalEnv("HYBRID_MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000");
  validateOptionalEnv("HYBRID_MONGO_SOCKET_TIMEOUT_MS", "15000");

  // Collections and indices
  validateOptionalEnv("HYBRID_KNOWLEDGE_COLLECTION", "knowledge_chunks");
  validateOptionalEnv("HYBRID_VECTOR_INDEX", "vector_index");

  if (validationErrors.length > 0) {
    console.error("❌ HYBRID SYSTEM CONFIGURATION ERRORS:");
    validationErrors.forEach((error) => {
      console.error(`   - ${error.variable}: ${error.reason}`);
    });

    throw new Error(
      `Hybrid system configuration validation failed: ${validationErrors.length} error(s) found`
    );
  }

  console.log("✅ Hybrid system configuration validated successfully");
};

export const printHybridConfig = (): void => {
  console.log("\n📋 HYBRID SYSTEM CONFIGURATION:");
  console.log("  API Keys:");
  console.log(`    - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✓ Set" : "✗ Missing"}`);
  console.log(`    - MONGO_URI: ${process.env.MONGO_URI ? "✓ Set" : "✗ Missing"}`);
  console.log("  LLM Models:");
  console.log(
    `    - Ollama Base URL: ${validateOptionalEnv("OLLAMA_BASE_URL", "http://localhost:11434")}`
  );
  console.log(`    - Chat Model: ${validateOptionalEnv("OLLAMA_CHAT_MODEL", "gemma")}`);
  console.log(`    - Embedding Model: ${validateOptionalEnv("OLLAMA_EMBED_MODEL", "nomic-embed-text")}`);
  console.log("  Timeouts:");
  console.log(
    `    - Ollama Chat: ${validateOptionalEnv("HYBRID_OLLAMA_CHAT_TIMEOUT_MS", "3000")}ms`
  );
  console.log(
    `    - Ollama Embed: ${validateOptionalEnv("HYBRID_OLLAMA_EMBED_TIMEOUT_MS", "1200")}ms`
  );
  console.log(`    - Gemini: ${validateOptionalEnv("HYBRID_GEMINI_TIMEOUT_MS", "2800")}ms`);
  console.log("  RAG Settings:");
  console.log(`    - Top K: ${validateOptionalEnv("HYBRID_TOP_K", "5")}`);
  console.log(`    - Num Candidates: ${validateOptionalEnv("HYBRID_NUM_CANDIDATES", "100")}`);
  console.log(`    - Min Confidence: ${validateOptionalEnv("HYBRID_MIN_CONFIDENCE", "0.7")}`);
  console.log("");
};
