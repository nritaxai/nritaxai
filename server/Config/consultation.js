const sanitize = (value) => (typeof value === "string" ? value.trim() : "");

export const CONSULTATION_WEBHOOK_URL =
  sanitize(process.env.CONSULTATION_WEBHOOK_URL) ||
  "https://n8n.caloganathan.com/webhook/consultation-booking";
