export const CONSULTATION_WEBHOOKS = {
  booking: "https://n8n.caloganathan.com/webhook/consultation-booking",
  reschedule: "https://n8n.caloganathan.com/webhook/consultation-reschedule",
  cancel: "https://n8n.caloganathan.com/webhook/consultation-cancel",
} as const;

export const AVAILABLE_CONSULTATION_TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
] as const;

export type ConsultationIdentifier =
  | { key: "token"; value: string }
  | { key: "bookingId"; value: string }
  | { key: "email"; value: string };

export type ConsultationBookingPayload = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  contactMethod: string;
  country: string;
  date: string;
  time: string;
  service: string;
  queryDetails: string;
};

type JsonRecord = Record<string, unknown>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export const trimValue = (value: unknown) => String(value ?? "").trim();

export const isValidEmail = (value: string) => EMAIL_PATTERN.test(trimValue(value));

export const normalizeConsultationDate = (value: string) => {
  const trimmed = trimValue(value);
  return DATE_PATTERN.test(trimmed) ? trimmed : "";
};

export const normalizeConsultationTime = (value: string) => {
  const trimmed = trimValue(value);
  if (!trimmed) return "";
  if (TIME_PATTERN.test(trimmed)) return trimmed;

  const date = new Date(`1970-01-01T${trimmed}`);
  if (Number.isNaN(date.getTime())) return "";
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
};

const safeParseJson = async (response: Response) => {
  const rawText = await response.text();
  if (!trimValue(rawText)) return null;

  try {
    return JSON.parse(rawText) as JsonRecord;
  } catch {
    return { message: rawText } as JsonRecord;
  }
};

export const extractWebhookErrorMessage = (payload: JsonRecord | null, fallback: string) => {
  const message =
    trimValue(payload?.message) ||
    trimValue(payload?.error) ||
    trimValue((payload?.data as JsonRecord | undefined)?.message) ||
    fallback;
  return message;
};

export const postConsultationWebhook = async <TResponse extends JsonRecord = JsonRecord>(
  url: string,
  payload: JsonRecord,
) => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Unable to reach the consultation service. Please try again.");
  }

  const data = (await safeParseJson(response)) as TResponse | null;
  if (!response.ok) {
    throw new Error(
      extractWebhookErrorMessage(data as JsonRecord | null, "Unable to process your consultation request right now.")
    );
  }

  return data;
};

export const getConsultationIdentifierFromSearchParams = (searchParams: URLSearchParams): ConsultationIdentifier | null => {
  const token = trimValue(searchParams.get("token"));
  if (token) return { key: "token", value: token };

  const bookingId = trimValue(searchParams.get("bookingId"));
  if (bookingId) return { key: "bookingId", value: bookingId };

  const email = trimValue(searchParams.get("email"));
  if (email && isValidEmail(email)) return { key: "email", value: email };

  return null;
};

export const buildReschedulePayload = (
  identifier: ConsultationIdentifier,
  date: string,
  time: string,
) => ({
  [identifier.key]: identifier.value,
  date: normalizeConsultationDate(date),
  time: normalizeConsultationTime(time),
});

export const buildCancelPayload = (identifier: ConsultationIdentifier) => ({
  [identifier.key]: identifier.value,
});

