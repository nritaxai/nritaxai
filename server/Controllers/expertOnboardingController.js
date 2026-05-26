import { createWebhookSignatureHeaders } from "../services/webhookSecurity.js";

const EXPERT_ONBOARDING_WEBHOOK_URL = String(
  process.env.EXPERT_ONBOARDING_WEBHOOK_URL || "https://n8n.caloganathan.com/webhook/expert-onboarding"
).trim();
const EXPERT_ONBOARDING_TIMEOUT_MS = Number(process.env.EXPERT_ONBOARDING_TIMEOUT_MS || 15000);
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

const DEFAULT_MOBILE_PLACEHOLDER = "Not Provided";
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
      fileField: req.file?.fieldname || null,
      fileName: req.file?.originalname || null,
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
      return res.status(400).json(buildFieldErrorResponse(fieldErrors));
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
        return res.status(webhookResponse.ok ? 400 : webhookResponse.status).json({
          success: false,
          message: clean(webhookPayload?.message) || "Submission failed. Please try again.",
        });
      }

      return res.status(200).json({
        success: true,
        message: clean(webhookPayload?.message) || "Application submitted successfully.",
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
    }
  } catch (error) {
    console.error("[expert-onboarding] unexpected error:", error);
    return res.status(500).json({
      success: false,
      message: "Submission failed. Please try again.",
    });
  }
};
