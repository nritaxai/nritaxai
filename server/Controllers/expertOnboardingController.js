import crypto from "crypto";

const EXPERT_ONBOARDING_WEBHOOK_URL =
  String(process.env.EXPERT_ONBOARDING_WEBHOOK_URL || "https://n8n.caloganathan.com/webhook/expert-onboarding").trim();
const CAPTCHA_TTL_MS = Number(process.env.EXPERT_ONBOARDING_CAPTCHA_TTL_MS || 5 * 60 * 1000);
const CAPTCHA_LENGTH = Math.min(Math.max(Number(process.env.EXPERT_ONBOARDING_CAPTCHA_LENGTH || 5), 4), 6);
const EXPERT_ONBOARDING_TIMEOUT_MS = Number(process.env.EXPERT_ONBOARDING_TIMEOUT_MS || 15000);

const REQUIRED_FIELDS = [
  "fullName",
  "mobileNumber",
  "email",
  "pincode",
  "membershipNumber",
  "cop",
  "profession",
  "areaOfExpertise",
];

const challengeStore = new Map();

const clean = (value) => (typeof value === "string" ? value.trim() : "");

const cleanupExpiredChallenges = () => {
  const now = Date.now();

  for (const [challengeId, challenge] of challengeStore.entries()) {
    if (!challenge || challenge.expiresAt <= now || challenge.usedAt) {
      challengeStore.delete(challengeId);
    }
  }
};

const hashAnswer = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const generateChallengeValue = () => {
  const min = 10 ** (CAPTCHA_LENGTH - 1);
  const max = 10 ** CAPTCHA_LENGTH - 1;
  return `${crypto.randomInt(min, max + 1)}`;
};

const parseWebhookResponse = async (response) => {
  const rawText = await response.text();
  const trimmedBody = rawText.trim();

  if (!trimmedBody) {
    return null;
  }

  try {
    return JSON.parse(trimmedBody);
  } catch {
    return { message: trimmedBody };
  }
};

const buildWebhookFormData = (body, file) => {
  const formData = new FormData();

  for (const field of REQUIRED_FIELDS) {
    formData.append(field, clean(body?.[field]));
  }

  formData.append(
    "resume",
    new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }),
    file.originalname || "resume"
  );

  return formData;
};

const validateCaptchaChallenge = ({ challengeId, answer }) => {
  cleanupExpiredChallenges();

  const normalizedChallengeId = clean(challengeId);
  const normalizedAnswer = clean(answer);

  if (!normalizedChallengeId || !normalizedAnswer) {
    return { ok: false, message: "Invalid CAPTCHA. Please try again." };
  }

  const stored = challengeStore.get(normalizedChallengeId);
  if (!stored) {
    return { ok: false, message: "Invalid CAPTCHA. Please try again." };
  }

  if (stored.usedAt) {
    challengeStore.delete(normalizedChallengeId);
    return { ok: false, message: "Invalid CAPTCHA. Please try again." };
  }

  if (stored.expiresAt <= Date.now()) {
    challengeStore.delete(normalizedChallengeId);
    return { ok: false, message: "CAPTCHA expired. Please refresh and try again." };
  }

  if (stored.answerHash !== hashAnswer(normalizedAnswer)) {
    console.warn("[expert-onboarding] CAPTCHA validation failed", {
      challengeId: normalizedChallengeId,
      reason: "answer_mismatch",
    });
    return { ok: false, message: "Invalid CAPTCHA. Please try again." };
  }

  stored.usedAt = Date.now();
  challengeStore.set(normalizedChallengeId, stored);
  return { ok: true };
};

export const createExpertOnboardingCaptchaChallenge = async (_req, res) => {
  cleanupExpiredChallenges();

  const challengeValue = generateChallengeValue();
  const challengeId = crypto.randomUUID();
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;

  challengeStore.set(challengeId, {
    answerHash: hashAnswer(challengeValue),
    expiresAt,
    usedAt: null,
  });

  return res.status(200).json({
    success: true,
    challengeId,
    challengeValue,
    expiresAt: new Date(expiresAt).toISOString(),
  });
};

export const submitExpertOnboarding = async (req, res) => {
  cleanupExpiredChallenges();

  try {
    const body = req.body || {};

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload your resume.",
      });
    }

    for (const field of REQUIRED_FIELDS) {
      if (!clean(body[field])) {
        return res.status(400).json({
          success: false,
          message: "Please fill all required fields.",
        });
      }
    }

    const challengeId = clean(body.captchaChallengeId);
    const captchaAnswer = clean(body.captchaAnswer);
    const captchaValidation = validateCaptchaChallenge({
      challengeId,
      answer: captchaAnswer,
    });

    if (!captchaValidation.ok) {
      return res.status(400).json({
        success: false,
        message: captchaValidation.message,
      });
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), EXPERT_ONBOARDING_TIMEOUT_MS);

    try {
      const webhookResponse = await fetch(EXPERT_ONBOARDING_WEBHOOK_URL, {
        method: "POST",
        body: buildWebhookFormData(body, req.file),
        signal: abortController.signal,
      });

      const webhookPayload = await parseWebhookResponse(webhookResponse);

      if (!webhookResponse.ok || !webhookPayload?.success) {
        return res.status(webhookResponse.ok ? 400 : webhookResponse.status).json({
          success: false,
          message: clean(webhookPayload?.message) || "Submission failed. Please try again.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          clean(webhookPayload?.message) || "Application submitted successfully.",
        resumeLink: clean(webhookPayload?.resumeLink),
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return res.status(504).json({
          success: false,
          message: "Submission timed out. Please try again.",
        });
      }

      console.error("[expert-onboarding] submit proxy error:", error);
      return res.status(502).json({
        success: false,
        message: "Unable to reach the onboarding service. Please try again.",
      });
    } finally {
      clearTimeout(timeoutId);
      challengeStore.delete(challengeId);
    }
  } catch (error) {
    console.error("[expert-onboarding] unexpected error:", error);
    return res.status(500).json({
      success: false,
      message: "Submission failed. Please try again.",
    });
  }
};
