const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const HIDDEN_CONTEXT_MAX_MATCHES = toPositiveNumber(process.env.HIDDEN_CONTEXT_MAX_MATCHES, 2);
const HIDDEN_CONTEXT_MAX_CHARS_PER_MATCH = toPositiveNumber(process.env.HIDDEN_CONTEXT_MAX_CHARS_PER_MATCH, 700);
const HIDDEN_CONTEXT_MAX_TOTAL_CHARS = toPositiveNumber(process.env.HIDDEN_CONTEXT_MAX_TOTAL_CHARS, 1400);

const trimContextSnippet = (text = "", maxChars = HIDDEN_CONTEXT_MAX_CHARS_PER_MATCH) => {
  const compactText = String(text || "").replace(/\s+/g, " ").trim();
  if (compactText.length <= maxChars) return compactText;
  return `${compactText.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
};

export const buildHiddenContextFromMatches = (matches = []) => {
  if (!Array.isArray(matches) || !matches.length) return "";

  const selected = matches
    .slice(0, HIDDEN_CONTEXT_MAX_MATCHES)
    .map((match) => trimContextSnippet(match?.text || ""))
    .filter(Boolean);

  if (!selected.length) return "";

  const joined = selected.join("\n\n");
  if (joined.length <= HIDDEN_CONTEXT_MAX_TOTAL_CHARS) return joined;
  return `${joined.slice(0, Math.max(0, HIDDEN_CONTEXT_MAX_TOTAL_CHARS - 3)).trim()}...`;
};
