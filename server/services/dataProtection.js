import crypto from "crypto";

const REDACTION_PATTERNS = [
  { name: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  { name: "phone", pattern: /(?<!\w)(?:\+?\d[\d()\-\s]{7,}\d)(?!\w)/g, replacement: "[REDACTED_PHONE]" },
  { name: "pan", pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, replacement: "[REDACTED_PAN]" },
  { name: "token", pattern: /\b(?:sk|pk|rk|rzp|tok|jwt)_[A-Z0-9_\-]{8,}\b/gi, replacement: "[REDACTED_TOKEN]" },
  { name: "card", pattern: /\b(?:\d[ -]*?){13,19}\b/g, replacement: "[REDACTED_CARD]" },
];

const ENCRYPTION_PREFIX = "enc:v1:";

const getEncryptionKey = () => {
  const raw = String(process.env.DATA_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;

  try {
    const asBuffer = /^[A-Fa-f0-9]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (asBuffer.length === 32) return asBuffer;
  } catch {
  }

  return crypto.createHash("sha256").update(raw).digest();
};

export const hashValue = (value = "") =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

export const maskEmail = (email = "") => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized.includes("@")) return normalized ? "[REDACTED_EMAIL]" : "";
  const [localPart, domain] = normalized.split("@");
  const visibleLocal = localPart.length <= 2 ? `${localPart[0] || ""}*` : `${localPart.slice(0, 2)}***`;
  const visibleDomain = domain.length <= 4 ? "***" : `***${domain.slice(-4)}`;
  return `${visibleLocal}@${visibleDomain}`;
};

export const maskPhone = (phone = "") => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const suffix = digits.slice(-2);
  return `***${suffix}`;
};

export const redactText = (value = "") =>
  REDACTION_PATTERNS.reduce(
    (acc, rule) => acc.replace(rule.pattern, rule.replacement),
    String(value || "")
  );

export const redactObject = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message || ""),
    };
  }
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes("password") || normalizedKey.includes("secret") || normalizedKey.includes("token")) {
        return [key, "[REDACTED_SECRET]"];
      }
      if (normalizedKey.includes("email")) {
        return [key, maskEmail(entry)];
      }
      if (normalizedKey.includes("phone") || normalizedKey.includes("mobile") || normalizedKey.includes("whatsapp")) {
        return [key, maskPhone(entry)];
      }
      return [key, redactObject(entry, seen)];
    })
  );
};

export const encryptAtRest = (plainText = "") => {
  const key = getEncryptionKey();
  const normalized = String(plainText || "");
  if (!normalized) return "";
  if (!key) return normalized;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};

export const decryptAtRest = (cipherText = "") => {
  const key = getEncryptionKey();
  const normalized = String(cipherText || "");
  if (!normalized || !normalized.startsWith(ENCRYPTION_PREFIX) || !key) return normalized;

  const payload = normalized.slice(ENCRYPTION_PREFIX.length);
  const [ivB64, tagB64, bodyB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !bodyB64) return normalized;

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(bodyB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return normalized;
  }
};

export const buildDeletedUserEmail = (userId = "") => `deleted+${String(userId || "user")}@deleted.local`;

export const buildDeletionSummary = (user = {}) => ({
  emailHash: hashValue(user?.email || ""),
  phoneHash: hashValue(user?.phone || ""),
  nameHash: hashValue(user?.name || ""),
});
