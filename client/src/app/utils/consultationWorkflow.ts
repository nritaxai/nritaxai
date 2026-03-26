export const CONSULTATION_WEBHOOKS = {
  booking: "https://n8n.caloganathan.com/webhook/consultation-booking",
  reschedule: "https://n8n.caloganathan.com/webhook/consultation-reschedule",
  cancel: "https://n8n.caloganathan.com/webhook/consultation-cancel",
} as const;

export const EXPERT_ONBOARDING_WEBHOOK =
  "https://n8n.caloganathan.com/webhook/expert-onboarding";

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

export const CONSULTATION_TIME_ZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
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
  preferredDate: string;
  preferredTime: string;
  timeZone: string;
  service: string;
  queryDetails: string;
};

type JsonRecord = Record<string, unknown>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const IST_OFFSET_MINUTES = 5 * 60 + 30;

const padTimePart = (value: number) => `${value}`.padStart(2, "0");

export const trimValue = (value: unknown) => String(value ?? "").trim();

export const isValidEmail = (value: string) => EMAIL_PATTERN.test(trimValue(value));

export const getBrowserTimeZone = () => {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") {
    return "";
  }

  return trimValue(Intl.DateTimeFormat().resolvedOptions().timeZone);
};

export const getDefaultConsultationTimeZone = () => {
  const browserTimeZone = getBrowserTimeZone();
  return CONSULTATION_TIME_ZONES.includes(browserTimeZone as (typeof CONSULTATION_TIME_ZONES)[number])
    ? browserTimeZone
    : "Asia/Kolkata";
};

export const normalizeConsultationDate = (value: string) => {
  const trimmed = trimValue(value);
  return DATE_PATTERN.test(trimmed) ? trimmed : "";
};

const parseConsultationDate = (value: string) => {
  const normalized = normalizeConsultationDate(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getTodayConsultationDate = (now = new Date()) =>
  `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;

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

export const normalizeConsultationTimeZone = (value: string) => {
  const trimmed = trimValue(value);
  if (!trimmed) return "";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return "";
  }
};

const toMinutes = (time: string) => {
  const normalized = normalizeConsultationTime(time);
  if (!normalized) return -1;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
};

const getDatePartsInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
  return { year, month, day };
};

const formatDateParts = ({ year, month, day }: { year: number; month: number; day: number }) =>
  `${year}-${padTimePart(month)}-${padTimePart(day)}`;

const getTimePartsInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { hours, minutes };
};

const getTimeInTimeZone = (date: Date, timeZone: string) => {
  const { hours, minutes } = getTimePartsInTimeZone(date, timeZone);
  return `${padTimePart(hours)}:${padTimePart(minutes)}`;
};

const getUtcDateForIstSlot = (year: number, month: number, day: number, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes - IST_OFFSET_MINUTES));
};

const shiftDate = (date: string, dayDelta: number) => {
  const parsedDate = parseConsultationDate(date);
  if (!parsedDate) return "";
  const shifted = new Date(parsedDate);
  shifted.setDate(shifted.getDate() + dayDelta);
  return formatDateParts({
    year: shifted.getFullYear(),
    month: shifted.getMonth() + 1,
    day: shifted.getDate(),
  });
};

const getCurrentMinutesInTimeZone = (now: Date, timeZone: string) => {
  const { hours, minutes } = getTimePartsInTimeZone(now, timeZone);
  return hours * 60 + minutes;
};

const getTodayInTimeZone = (now: Date, timeZone: string) => formatDateParts(getDatePartsInTimeZone(now, timeZone));

export const getAvailableConsultationTimeSlots = (date: string, timeZone = "Asia/Kolkata", now = new Date()) => {
  const normalizedDate = normalizeConsultationDate(date);
  const normalizedTimeZone = normalizeConsultationTimeZone(timeZone) || "Asia/Kolkata";
  if (!normalizedDate) return [];

  const slotGroups = [-1, 0, 1]
    .map((offset) => {
      const istDate = shiftDate(normalizedDate, offset);
      const parsedIstDate = parseConsultationDate(istDate);
      if (!parsedIstDate || parsedIstDate.getDay() === 0) {
        return { offset, times: [] as string[] };
      }

      const { year, month, day } = {
        year: parsedIstDate.getFullYear(),
        month: parsedIstDate.getMonth() + 1,
        day: parsedIstDate.getDate(),
      };

      const times = AVAILABLE_CONSULTATION_TIME_SLOTS.map((slot) => {
        const utcDate = getUtcDateForIstSlot(year, month, day, slot);
        return {
          date: formatDateParts(getDatePartsInTimeZone(utcDate, normalizedTimeZone)),
          time: getTimeInTimeZone(utcDate, normalizedTimeZone),
        };
      })
        .filter((slot) => slot.date === normalizedDate)
        .map((slot) => slot.time)
        .sort((left, right) => toMinutes(left) - toMinutes(right));

      return { offset, times };
    })
    .sort((left, right) => {
      if (right.times.length !== left.times.length) return right.times.length - left.times.length;
      return Math.abs(left.offset) - Math.abs(right.offset);
    });

  const localSlots = slotGroups[0]?.times || [];

  const todayIso = getTodayInTimeZone(now, normalizedTimeZone);
  if (normalizedDate !== todayIso) return localSlots;

  const currentMinutes = getCurrentMinutesInTimeZone(now, normalizedTimeZone);
  return localSlots.filter((slot) => toMinutes(slot) > currentMinutes);
};

export const formatConsultationTimeLabel = (value: string) => {
  const normalized = normalizeConsultationTime(value);
  if (!normalized) return trimValue(value);

  const [hours, minutes] = normalized.split(":").map(Number);
  const date = new Date(Date.UTC(1970, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

export const getConsultationDateConstraintError = (date: string, now = new Date()) => {
  const parsedDate = parseConsultationDate(date);
  if (!parsedDate) return "";

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (parsedDate < today) return "Please choose a date from today onwards.";
  if (parsedDate.getDay() === 0) return "Bookings are not available on Sundays.";

  return "";
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
  token: identifier.key === "token" ? identifier.value : "",
  date: normalizeConsultationDate(date),
  time: normalizeConsultationTime(time),
  timeZone: getBrowserTimeZone(),
});

export const buildCancelPayload = (identifier: ConsultationIdentifier) => ({
  token: identifier.key === "token" ? identifier.value : "",
});
