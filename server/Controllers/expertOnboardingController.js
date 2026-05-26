import { createWebhookSignatureHeaders } from "../services/webhookSecurity.js";

const EXPERT_ONBOARDING_WEBHOOK_URL = String(
  process.env.EXPERT_ONBOARDING_WEBHOOK_URL || "https://n8n.caloganathan.com/webhook/expert-onboarding"
).trim();
const EXPERT_ONBOARDING_TIMEOUT_MS = Number(process.env.EXPERT_ONBOARDING_TIMEOUT_MS || 15000);
const RECAPTCHA_SECRET_KEY = String(process.env.RECAPTCHA_SECRET_KEY || "").trim();
const EXPERT_ONBOARDING_DEBUG =
  String(process.env.EXPERT_ONBOARDING_DEBUG || "").trim().toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";

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

const ALLOWED_FILE_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_PATTERN = /^\d{6}$/;

const clean = (value) => (typeof value === "string" ? value.trim() : "");

const getFileExtension = (fileName = "") => {
  const normalized = clean(fileName).toLowerCase();
  const extensionIndex = normalized.lastIndexOf(".");
  return extensionIndex >= 0 ? normalized.slice(extensionIndex) : "";
};

const logDebug = (message, details) => {
  if (!EXPERT_ONBOARDING_DEBUG) return;
  if (details === undefined) {
    console.info(`[expert-onboarding] ${message}`);
    return;
  }

  console.info(`[expert-onboarding] ${message}`, details);
};

const isHtmlPayload = (value) => /<!doctype html|<html[\s>]/i.test(clean(value));

const parseWebhookResponse = async (response) => {
  const rawText = await response.text();
  const trimmedBody = rawText.trim();

  if (!trimmedBody) {
    return null;
  }

  try {
    return JSON.parse(trimmedBody);
  } catch {
    return {
      message: isHtmlPayload(trimmedBody)
        ? "Upstream onboarding service returned an unexpected HTML response."
        : trimmedBody,
    };
  }
};

const normalizeRequestBody = (body) => {
  const normalizedQualification = clean(body?.qualification) || clean(body?.profession);
  const normalizedProfession = clean(body?.profession) || normalizedQualification;

  return {
    ...body,
    fullName: clean(body?.fullName),
    mobileNumber: clean(body?.mobileNumber),
    email: clean(body?.email),
    pincode: clean(body?.pincode),
    membershipNumber: clean(body?.membershipNumber),
    cop: clean(body?.cop),
    qualification: normalizedQualification,
    profession: normalizedProfession,
    areaOfExpertise: clean(body?.areaOfExpertise),
    "g-recaptcha-response": clean(body?.["g-recaptcha-response"]),
  };
};

const buildFieldErrorResponse = (
  fieldErrors = {},
  fallbackMessage = "Please correct the highlighted fields.",
  extra = {}
) => {
  const normalizedFieldErrors = Object.fromEntries(
    Object.entries(fieldErrors).filter(([, value]) => clean(value))
  );

  return {
    success: false,
    message: fallbackMessage,
    fieldErrors: normalizedFieldErrors,
    ...extra,
  };
};

const validateUploadedProfile = (file) => {
  if (!file) {
    return "Please upload your profile document.";
  }

  const extension = getFileExtension(file.originalname || "");
  const mimeType = clean(file.mimetype);

  if (!ALLOWED_FILE_EXTENSIONS.has(extension) && !ALLOWED_FILE_TYPES.has(mimeType)) {
    return "Invalid file format. Upload a PDF, DOC, or DOCX file.";
  }

  return "";
};

const verifyRecaptchaToken = async (token, remoteIp) => {
  if (!token) {
    return {
      ok: false,
      code: "captcha_missing",
      message: "Security verification failed",
      fieldMessage: "Please complete the security verification before submitting your application.",
      googleCodes: [],
    };
  }

  if (!RECAPTCHA_SECRET_KEY) {
    console.error("[expert-onboarding] RECAPTCHA_SECRET_KEY is not configured");
    return {
      ok: false,
      code: "captcha_unavailable",
      message: "Security verification failed",
      fieldMessage: "Security verification is temporarily unavailable. Please try again shortly.",
      googleCodes: [],
    };
  }

  try {
    const payload = new URLSearchParams();
    payload.append("secret", RECAPTCHA_SECRET_KEY);
    payload.append("response", token);
    if (clean(remoteIp)) {
      payload.append("remoteip", clean(remoteIp));
    }

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    const result = await response.json();
    const googleCodes = Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [];

    logDebug("Google reCAPTCHA verify response.", {
      status: response.status,
      success: Boolean(result?.success),
      hostname: clean(result?.hostname),
      errorCodes: googleCodes,
    });

    if (!response.ok || !result?.success) {
      const isExpired =
        googleCodes.includes("timeout-or-duplicate") ||
        googleCodes.includes("invalid-input-response");

      return {
        ok: false,
        code: isExpired ? "captcha_expired" : "captcha_failed",
        message: "Security verification failed",
        fieldMessage: isExpired
          ? "Security verification expired. Please complete the CAPTCHA again."
          : "Please complete the CAPTCHA verification and try again.",
        googleCodes,
      };
    }

    return {
      ok: true,
      code: "captcha_verified",
      message: "Security verification passed",
      fieldMessage: "",
      googleCodes,
    };
  } catch (error) {
    console.error("[expert-onboarding] reCAPTCHA verification error:", error);
    return {
      ok: false,
      code: "captcha_network_error",
      message: "Security verification failed",
      fieldMessage: "Unable to validate security verification right now. Please retry in a moment.",
      googleCodes: [],
    };
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
  formData.append("verificationProvider", "google-recaptcha-v2");
  formData.append("g-recaptcha-response", clean(body?.["g-recaptcha-response"]));

  const blob = new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" });
  const fileName = file.originalname || "profile";

  formData.append("profile", blob, fileName);

  return formData;
};

const buildSignedWebhookHeaders = (body) =>
  createWebhookSignatureHeaders({
    payload: JSON.stringify({
      fullName: clean(body?.fullName),
      email: clean(body?.email),
      mobileNumber: clean(body?.mobileNumber),
      membershipNumber: clean(body?.membershipNumber),
    }),
    secret: process.env.EXPERT_ONBOARDING_WEBHOOK_SIGNING_SECRET,
    source: "nritax-expert-onboarding",
  });

export const submitExpertOnboarding = async (req, res) => {
  try {
    const body = normalizeRequestBody(req.body || {});
    const uploadedFile = req.file || null;
    const fieldErrors = {};

    logDebug("Received multipart expert onboarding request.", {
      body: req.body,
      recaptchaToken: req.body?.["g-recaptcha-response"],
      normalizedRecaptchaToken: body["g-recaptcha-response"],
      fileField: req.file?.fieldname || null,
      fileName: req.file?.originalname || null,
      hasFile: Boolean(req.file),
    });

    const profileError = validateUploadedProfile(uploadedFile);
    if (profileError) {
      fieldErrors.profile = profileError;
    }

    if (!clean(body.fullName)) {
      fieldErrors.fullName = "Please enter your full name.";
    }

    if (!clean(body.email)) {
      fieldErrors.email = "Please enter your email address.";
    } else if (!EMAIL_PATTERN.test(clean(body.email))) {
      fieldErrors.email = "Please enter a valid email address.";
    }

    if (!clean(body.mobileNumber)) {
      fieldErrors.mobileNumber = "Please enter your mobile number.";
    }

    if (!clean(body.pincode)) {
      fieldErrors.pincode = "Please enter your pincode.";
    } else if (!PINCODE_PATTERN.test(clean(body.pincode))) {
      fieldErrors.pincode = "Please enter a valid 6-digit pincode.";
    }

    if (!clean(body.membershipNumber)) {
      fieldErrors.membershipNumber = "Please enter your membership number.";
    }

    if (!clean(body.cop)) {
      fieldErrors.cop = "Please select your COP status.";
    }

    if (!clean(body.qualification)) {
      fieldErrors.qualification = "Please select your qualification.";
    }

    if (!clean(body.areaOfExpertise)) {
      fieldErrors.areaOfExpertise = "Please select your area of expertise.";
    }

    if (!clean(body["g-recaptcha-response"])) {
      fieldErrors.captcha = "Please complete the security verification before submitting your application.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      logDebug("Validation failed before CAPTCHA verification.", {
        response: buildFieldErrorResponse(fieldErrors),
      });
      return res.status(400).json(buildFieldErrorResponse(fieldErrors));
    }

    const recaptchaValidation = await verifyRecaptchaToken(
      body["g-recaptcha-response"],
      req.ip || req.headers["x-forwarded-for"]
    );

    if (!recaptchaValidation.ok) {
      const captchaFailureResponse = {
        success: false,
        message: "Security verification failed",
        code: recaptchaValidation.code,
        recaptchaCodes: recaptchaValidation.googleCodes || [],
      };
      logDebug("CAPTCHA verification failed.", {
        token: body["g-recaptcha-response"],
        response: captchaFailureResponse,
      });
      return res.status(400).json(captchaFailureResponse);
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), EXPERT_ONBOARDING_TIMEOUT_MS);

    try {
      const webhookResponse = await fetch(EXPERT_ONBOARDING_WEBHOOK_URL, {
        method: "POST",
        headers: buildSignedWebhookHeaders(body),
        body: buildWebhookFormData(body, uploadedFile),
        signal: abortController.signal,
      });

      const webhookPayload = await parseWebhookResponse(webhookResponse);

      logDebug("n8n expert onboarding webhook response received.", {
        status: webhookResponse.status,
        ok: webhookResponse.ok,
        body: webhookPayload,
      });

      if (!webhookResponse.ok || !webhookPayload?.success) {
        const failurePayload = {
          success: false,
          message: clean(webhookPayload?.message) || "Submission failed. Please try again.",
        };
        logDebug("Sending failure response to frontend.", failurePayload);
        return res.status(webhookResponse.ok ? 400 : webhookResponse.status).json(failurePayload);
      }

      const successPayload = {
        success: true,
        message: clean(webhookPayload?.message) || "Application submitted successfully.",
        resumeLink: clean(webhookPayload?.resumeLink),
      };
      logDebug("Sending success response to frontend.", successPayload);
      return res.status(200).json(successPayload);
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutResponse = {
          success: false,
          message: "Submission timed out. Please try again.",
        };
        logDebug("Sending timeout response to frontend.", timeoutResponse);
        return res.status(504).json(timeoutResponse);
      }

      console.error("[expert-onboarding] submit proxy error:", error);
      const proxyErrorResponse = {
        success: false,
        message: "Unable to reach the onboarding service. Please try again.",
      };
      logDebug("Sending proxy error response to frontend.", proxyErrorResponse);
      return res.status(502).json(proxyErrorResponse);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("[expert-onboarding] unexpected error:", error);
    const unexpectedErrorResponse = {
      success: false,
      message: "Submission failed. Please try again.",
    };
    logDebug("Sending unexpected error response to frontend.", unexpectedErrorResponse);
    return res.status(500).json(unexpectedErrorResponse);
  }
};
