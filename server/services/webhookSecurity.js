import crypto from "crypto";
import { hashValue } from "./dataProtection.js";

export const createWebhookSignatureHeaders = ({ payload = "", secret = "", source = "nritax-server" } = {}) => {
  const normalizedSecret = String(secret || "").trim();
  if (!normalizedSecret) return {};

  const timestamp = String(Date.now());
  const body = String(payload || "");
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac("sha256", normalizedSecret).update(signedPayload).digest("hex");

  return {
    "x-nritax-signature": signature,
    "x-nritax-timestamp": timestamp,
    "x-nritax-source": source,
    "x-nritax-body-sha256": hashValue(body),
  };
};

export const timingSafeEqualHex = (left = "", right = "") => {
  const a = String(left || "").trim();
  const b = String(right || "").trim();
  if (!a || !b || a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
};
