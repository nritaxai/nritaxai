const DEFAULT_YUKTI_WEBHOOK_URL =
  "https://n8n.caloganathan.com/webhook/yukti-tax-agent";
const YUKTI_WEBHOOK_URL = String(
  process.env.YUKTI_WEBHOOK_URL || DEFAULT_YUKTI_WEBHOOK_URL
).trim();
const YUKTI_TIMEOUT_MS = Number(process.env.YUKTI_TIMEOUT_MS || 15000);

const TAX_KEYWORD_PATTERN =
  /\b(tax|taxes|taxation|nri|india|indian|dtaa|itr|tds|gst|income tax|capital gains|withholding|residential status|residency|trc|form 10f|pan|nre|nro|fema|remittance)\b/i;

const sanitizeText = (value) => (typeof value === "string" ? value.trim() : "");

const isValidOptionalField = (value, maxLength = 80) =>
  !value || (typeof value === "string" && value.trim().length <= maxLength);

const isTaxQuestion = (question) => TAX_KEYWORD_PATTERN.test(String(question || ""));

const parseWebhookResponse = async (response) => {
  const rawText = await response.text();

  if (!rawText || !rawText.trim()) {
    return { data: null, rawText: "" };
  }

  try {
    return {
      data: JSON.parse(rawText),
      rawText,
    };
  } catch {
    return {
      data: null,
      rawText: rawText.trim(),
    };
  }
};

const extractAnswer = (payload, rawText = "") => {
  if (typeof payload === "string" && payload.trim()) return payload.trim();

  const directCandidates = [
    payload?.answer,
    payload?.reply,
    payload?.message,
    payload?.text,
    payload?.output,
    payload?.response,
    payload?.data?.answer,
    payload?.data?.reply,
    payload?.result?.answer,
    payload?.result?.reply,
  ];

  const directMatch = directCandidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  if (directMatch) return directMatch.trim();

  if (Array.isArray(payload)) {
    const textMatch = payload
      .map((item) => extractAnswer(item))
      .find((value) => typeof value === "string" && value.trim());
    if (textMatch) return textMatch.trim();
  }

  if (rawText.trim()) return rawText.trim();
  return "";
};

export const askYukti = async (req, res) => {
  const question = sanitizeText(req.body?.question);
  const country = sanitizeText(req.body?.country);
  const taxYear = sanitizeText(req.body?.taxYear);
  const residentialStatus = sanitizeText(req.body?.residentialStatus);
  const requestedUserId = sanitizeText(req.body?.userId);
  const userId = requestedUserId || req.user?._id?.toString?.() || "";

  if (!question) {
    return res.status(400).json({
      ok: false,
      agent: "Yukti",
      answer: "Question is required.",
    });
  }

  if (question.length < 3 || question.length > 1500) {
    return res.status(400).json({
      ok: false,
      agent: "Yukti",
      answer: "Question must be between 3 and 1500 characters.",
    });
  }

  if (
    !isValidOptionalField(country, 80) ||
    !isValidOptionalField(taxYear, 24) ||
    !isValidOptionalField(residentialStatus, 80) ||
    !isValidOptionalField(userId, 120)
  ) {
    return res.status(400).json({
      ok: false,
      agent: "Yukti",
      answer: "One or more optional fields are invalid.",
    });
  }

  if (!isTaxQuestion(question)) {
    return res.status(400).json({
      ok: false,
      agent: "Yukti",
      answer: "Yukti answers only tax-related questions, especially Indian tax and NRI tax.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YUKTI_TIMEOUT_MS);

  try {
    const payload = {
      question,
      ...(country ? { country } : {}),
      ...(taxYear ? { taxYear } : {}),
      ...(residentialStatus ? { residentialStatus } : {}),
      ...(userId ? { userId } : {}),
    };

    const webhookResponse = await fetch(YUKTI_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const webhookResult = await parseWebhookResponse(webhookResponse);
    const answer = extractAnswer(webhookResult.data, webhookResult.rawText);

    if (!webhookResponse.ok) {
      return res.status(502).json({
        ok: false,
        agent: "Yukti",
        answer:
          answer || `Yukti webhook failed with status ${webhookResponse.status}.`,
      });
    }

    if (!answer) {
      return res.status(502).json({
        ok: false,
        agent: "Yukti",
        answer: "Yukti did not return a usable answer.",
      });
    }

    return res.status(200).json({
      ok: true,
      agent: "Yukti",
      answer,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({
        ok: false,
        agent: "Yukti",
        answer: "Yukti request timed out. Please try again.",
      });
    }

    console.error("[yukti] request failed", error);
    return res.status(500).json({
      ok: false,
      agent: "Yukti",
      answer: "Unable to reach Yukti right now. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
};
