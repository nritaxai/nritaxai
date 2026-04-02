import crypto from "crypto";

const EXPERT_ONBOARDING_WEBHOOK_URL =
  String(process.env.EXPERT_ONBOARDING_WEBHOOK_URL || "https://n8n.caloganathan.com/webhook/expert-onboarding").trim();
const CAPTCHA_TTL_MS = Number(process.env.EXPERT_ONBOARDING_CAPTCHA_TTL_MS || 5 * 60 * 1000);
const CAPTCHA_LENGTH = Math.min(Math.max(Number(process.env.EXPERT_ONBOARDING_CAPTCHA_LENGTH || 5), 4), 6);
const EXPERT_ONBOARDING_TIMEOUT_MS = Number(process.env.EXPERT_ONBOARDING_TIMEOUT_MS || 15000);
const RECAPTCHA_SECRET_KEY = String(process.env.RECAPTCHA_SECRET_KEY || "").trim();

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
const DEFAULT_MOBILE_PLACEHOLDER = "Not Provided";

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

const verifyRecaptchaToken = async (token) => {
  if (!token) {
    return { ok: false, message: "Please complete the CAPTCHA." };
  }

  if (!RECAPTCHA_SECRET_KEY) {
    console.error("[expert-onboarding] RECAPTCHA_SECRET_KEY is not configured");
    return { ok: false, message: "CAPTCHA verification is unavailable. Please try again later." };
  }

  try {
    const payload = new URLSearchParams();
    payload.append("secret", RECAPTCHA_SECRET_KEY);
    payload.append("response", token);

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      console.warn("[expert-onboarding] reCAPTCHA verification failed", {
        status: response.status,
        errors: Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [],
      });
      return { ok: false, message: "Please complete the CAPTCHA." };
    }

    return { ok: true };
  } catch (error) {
    console.error("[expert-onboarding] reCAPTCHA verification error:", error);
    return { ok: false, message: "Unable to verify CAPTCHA. Please try again." };
  }
};

const buildWebhookFormData = (body, file) => {
  const formData = new FormData();

  for (const field of REQUIRED_FIELDS) {
    formData.append(field, clean(body?.[field]));
  }

  formData.append("qualification", clean(body?.qualification) || clean(body?.profession));
  formData.append("profession", clean(body?.profession) || clean(body?.qualification));
  formData.append("pincode", clean(body?.pincode));
  formData.append("membershipNumber", clean(body?.membershipNumber));
  formData.append("cop", clean(body?.cop));

  formData.append(
    "resume",
    new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }),
    file.originalname || "resume"
  );
  formData.append(
    "profile",
    new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }),
    file.originalname || "profile"
  );

  return formData;
};

const normalizeRequestBody = (body) => {
  const normalizedQualification = clean(body?.qualification) || clean(body?.profession);
  const normalizedProfession = clean(body?.profession) || normalizedQualification;

  return {
    ...body,
    fullName: clean(body?.fullName),
    mobileNumber: clean(body?.mobileNumber) || DEFAULT_MOBILE_PLACEHOLDER,
    email: clean(body?.email),
    pincode: clean(body?.pincode),
    membershipNumber: clean(body?.membershipNumber),
    cop: clean(body?.cop),
    qualification: normalizedQualification,
    profession: normalizedProfession,
    areaOfExpertise: clean(body?.areaOfExpertise),
    captchaChallengeId: clean(body?.captchaChallengeId),
    captchaAnswer: clean(body?.captchaAnswer),
    "g-recaptcha-response": clean(body?.["g-recaptcha-response"]),
  };
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
    const body = normalizeRequestBody(req.body || {});
    const uploadedFile = req.file || req.files?.resume?.[0] || req.files?.profile?.[0] || null;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "Please upload your profile.",
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

    const recaptchaToken = body["g-recaptcha-response"];

    if (recaptchaToken) {
      const recaptchaValidation = await verifyRecaptchaToken(recaptchaToken);

      if (!recaptchaValidation.ok) {
        return res.status(400).json({
          success: false,
          message: recaptchaValidation.message,
        });
      }
    } else {
      const challengeId = body.captchaChallengeId;
      const captchaAnswer = body.captchaAnswer;
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
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), EXPERT_ONBOARDING_TIMEOUT_MS);

    try {
      const webhookResponse = await fetch(EXPERT_ONBOARDING_WEBHOOK_URL, {
        method: "POST",
        body: buildWebhookFormData(body, uploadedFile),
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
      if (!recaptchaToken) {
        challengeStore.delete(body.captchaChallengeId);
      }
    }
  } catch (error) {
    console.error("[expert-onboarding] unexpected error:", error);
    return res.status(500).json({
      success: false,
      message: "Submission failed. Please try again.",
    });
  }
};
