import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  Paperclip,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { Toaster, toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EXPERT_ONBOARDING_WEBHOOK, trimValue } from "../utils/consultationWorkflow";
import { IS_IOS_NATIVE_APP } from "../../config/appConfig";

type ExpertFormData = {
  fullName: string;
  email: string;
  pincode: string;
  membershipNumber: string;
  cop: string;
  qualification: string;
  customQualification: string;
  areaOfExpertise: string;
  customAreaOfExpertise: string;
};

type FieldKey = keyof ExpertFormData;
type ExpertFormFieldKey = FieldKey | "profile" | "captcha";
type SubmissionStage = "idle" | "verifying" | "uploading" | "submitting" | "finalizing";
type CaptchaStatus = "idle" | "verified" | "expired" | "error";

type ExpertOnboardingResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  code?: string;
  recaptchaCodes?: string[];
  fieldErrors?: Partial<Record<ExpertFormFieldKey, string>>;
};

const initialValues: ExpertFormData = {
  fullName: "",
  email: "",
  pincode: "",
  membershipNumber: "",
  cop: "",
  qualification: "",
  customQualification: "",
  areaOfExpertise: "",
  customAreaOfExpertise: "",
};

const SUBMISSION_TIMEOUT_MS = 45000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const RECAPTCHA_SITE_KEY = trimValue(import.meta.env.VITE_RECAPTCHA_SITE_KEY);
const SUCCESS_MESSAGE = "Your expert profile has been securely submitted to NRITAX.AI";
const FALLBACK_SUBMISSION_ERROR = "We couldn't complete your secure onboarding right now. Please try again.";
const CAPTCHA_MISSING_MESSAGE = "Please complete the security verification before submitting your application.";
const CAPTCHA_RETRY_MESSAGE = "Please complete a fresh security verification to continue.";
const CAPTCHA_VERIFIED_MESSAGE = "Identity verification secured";
const CAPTCHA_RENDER_ERROR_MESSAGE = "Security verification could not be loaded. Please refresh and try again.";
const PHASE_MESSAGES: Record<Exclude<SubmissionStage, "idle">, string> = {
  verifying: "Verifying security check...",
  uploading: "Encrypting profile package...",
  submitting: "Submitting Secure Application...",
  finalizing: "Finalizing secure onboarding...",
};

const isExpertOnboardingDebugEnabled =
  import.meta.env.DEV || String(import.meta.env.VITE_EXPERT_ONBOARDING_DEBUG || "").trim().toLowerCase() === "true";

const debugLog = (message: string, details?: unknown) => {
  if (!isExpertOnboardingDebugEnabled) return;

  if (details === undefined) {
    console.debug(`[JoinAsExpert] ${message}`);
    return;
  }

  console.debug(`[JoinAsExpert] ${message}`, details);
};

const resolveSelectedValue = (value: string, customValue: string) =>
  value === "Other" ? customValue.trim() : value.trim();

const getFileExtension = (fileName: string) => {
  const normalized = trimValue(fileName).toLowerCase();
  const extensionIndex = normalized.lastIndexOf(".");
  return extensionIndex >= 0 ? normalized.slice(extensionIndex) : "";
};

const validateProfileFile = (file: File | null) => {
  if (!file) return "Resume missing. Please upload your profile document.";

  const extension = getFileExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension) && !ALLOWED_FILE_TYPES.has(file.type)) {
    return "Invalid file format. Upload a PDF, DOC, or DOCX file.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Large file upload detected. Keep the resume under 10 MB.";
  }

  return "";
};

const safeParseJson = async (response: Response) => {
  const rawText = await response.text();
  if (!trimValue(rawText)) return null;

  try {
    return JSON.parse(rawText) as ExpertOnboardingResponse;
  } catch {
    return {
      message: rawText,
    } satisfies ExpertOnboardingResponse;
  }
};

const resolveSubmissionErrorMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "API timeout. The secure submission took too long. Please retry.";
  }

  if (error instanceof TypeError) {
    return "Network failure. Please check your connection and retry the secure upload.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return FALLBACK_SUBMISSION_ERROR;
};

const formFieldClassName =
  "min-h-[48px] w-full rounded-xl border border-slate-200/80 bg-white/85 px-4 py-3 text-sm text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition duration-200 placeholder:text-slate-400 focus-visible:border-sky-500 focus-visible:ring-[3px] focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100";
const formSelectClassName =
  "min-h-[48px] w-full appearance-none rounded-xl border border-slate-200/80 bg-white/85 px-4 py-3 pr-11 text-sm text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition duration-200 focus-visible:border-sky-500 focus-visible:ring-[3px] focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100";
const invalidFieldClassName = "border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-100";
const errorMessageClassName = "mt-1 text-[12px] text-rose-600";
const requiredAsterisk = <span className="text-rose-500">*</span>;

export function JoinAsExpertPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement | null>(null);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);
  const fieldRefs = useRef<Partial<Record<ExpertFormFieldKey, HTMLElement | null>>>({});
  const [values, setValues] = useState<ExpertFormData>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<ExpertFormFieldKey, string>>>({});
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submissionStage, setSubmissionStage] = useState<SubmissionStage>("idle");
  const [successMessage, setSuccessMessage] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaStatus, setCaptchaStatus] = useState<CaptchaStatus>("idle");
  const [captchaRenderKey, setCaptchaRenderKey] = useState(0);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawUser = localStorage.getItem("user");
      if (!rawUser) return;

      const parsedUser = JSON.parse(rawUser);
      setValues((prev) => ({
        ...prev,
        fullName: prev.fullName || trimValue(parsedUser?.name),
        email: prev.email || trimValue(parsedUser?.email),
      }));
    } catch {
      debugLog("Unable to hydrate onboarding form from localStorage.");
    }
  }, []);

  const setFieldRef = (field: ExpertFormFieldKey) => (element: HTMLElement | null) => {
    fieldRefs.current[field] = element;
  };

  const getFieldErrorId = (field: ExpertFormFieldKey) => `${field}-error`;

  const getFieldClassName = (field: ExpertFormFieldKey, baseClassName: string) =>
    errors[field] ? `${baseClassName} ${invalidFieldClassName}` : baseClassName;

  const scrollToFirstInvalidField = (validationErrors: Partial<Record<ExpertFormFieldKey, string>>) => {
    const orderedFields: ExpertFormFieldKey[] = [
      "fullName",
      "email",
      "pincode",
      "membershipNumber",
      "cop",
      "qualification",
      "areaOfExpertise",
      "profile",
      "captcha",
    ];

    const firstInvalidField = orderedFields.find((field) => validationErrors[field]);
    const element = firstInvalidField ? fieldRefs.current[firstInvalidField] : null;
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    if ("focus" in element && typeof element.focus === "function") {
      window.setTimeout(() => {
        element.focus({ preventScroll: true });
      }, 120);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    const nextValue = name === "pincode" ? value.replace(/\D/g, "").slice(0, 6) : value;

    setValues((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === "qualification" && nextValue !== "Other" ? { customQualification: "" } : {}),
      ...(name === "areaOfExpertise" && nextValue !== "Other" ? { customAreaOfExpertise: "" } : {}),
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
      ...(name === "customQualification" ? { qualification: "" } : {}),
      ...(name === "customAreaOfExpertise" ? { areaOfExpertise: "" } : {}),
    }));

    setShowErrorBanner(false);
    setErrorMessage("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    const fileError = validateProfileFile(file);

    setProfileFile(fileError ? null : file);
    setShowErrorBanner(false);
    setErrorMessage("");
    setErrors((prev) => ({
      ...prev,
      profile: fileError,
    }));

    if (fileError) {
      toast.warning(fileError);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
      return;
    }

    if (file) {
      toast.success("Secure document ready for upload.");
    }
  };

  const handleRemoveFile = () => {
    setProfileFile(null);
    setErrorMessage("");
    setErrors((prev) => ({
      ...prev,
      profile: "",
    }));

    if (resumeInputRef.current) {
      resumeInputRef.current.value = "";
    }
  };

  const refreshCaptchaWidget = (nextStatus: CaptchaStatus = "idle") => {
    setCaptchaToken("");
    setCaptchaStatus(nextStatus);
    setCaptchaRenderKey((current) => current + 1);
  };

  const handleCaptchaChange = (token: string | null) => {
    const normalizedToken = trimValue(token);
    console.log("[JoinAsExpert] captchaToken", normalizedToken);
    setCaptchaToken(normalizedToken);
    setCaptchaStatus(normalizedToken ? "verified" : "idle");
    setErrors((prev) => ({
      ...prev,
      captcha: "",
    }));
    setShowErrorBanner(false);
    setErrorMessage("");
  };

  const handleCaptchaExpired = () => {
    setCaptchaToken("");
    setCaptchaStatus("expired");
    setErrors((prev) => ({
      ...prev,
      captcha: submitAttempted ? CAPTCHA_RETRY_MESSAGE : "",
    }));
  };

  const handleCaptchaErrored = () => {
    setCaptchaToken("");
    setCaptchaStatus("error");
    setErrors((prev) => ({
      ...prev,
      captcha: CAPTCHA_RENDER_ERROR_MESSAGE,
    }));
  };

  const validateForm = (formValues: ExpertFormData, file: File | null, token: string) => {
    const validationErrors: Partial<Record<ExpertFormFieldKey, string>> = {};
    const email = trimValue(formValues.email);
    const qualification = resolveSelectedValue(formValues.qualification, formValues.customQualification);
    const areaOfExpertise = resolveSelectedValue(formValues.areaOfExpertise, formValues.customAreaOfExpertise);
    const profileError = validateProfileFile(file);

    if (!trimValue(formValues.fullName)) {
      validationErrors.fullName = "Please enter your full name.";
    }

    if (!email) {
      validationErrors.email = "Please enter your email address.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      validationErrors.email = "Please enter a valid email address.";
    }

    if (!trimValue(formValues.pincode)) {
      validationErrors.pincode = "Please enter your pincode.";
    } else if (!/^\d{6}$/.test(trimValue(formValues.pincode))) {
      validationErrors.pincode = "Please enter a valid 6-digit pincode.";
    }

    if (!trimValue(formValues.membershipNumber)) {
      validationErrors.membershipNumber = "Please enter your membership number.";
    }

    if (!["Active", "Inactive", "Not Applicable"].includes(trimValue(formValues.cop))) {
      validationErrors.cop = "Please select your COP status.";
    }

    if (!qualification) {
      validationErrors.qualification = "Please select your qualification.";
    }

    if (!areaOfExpertise) {
      validationErrors.areaOfExpertise = "Please select your area of expertise.";
    }

    if (profileError) {
      validationErrors.profile = profileError;
    }

    if (!trimValue(token)) {
      validationErrors.captcha = CAPTCHA_MISSING_MESSAGE;
    }

    return validationErrors;
  };

  const buildMultipartPayload = (formValues: ExpertFormData, file: File, captchaToken: string) => {
    const qualification = resolveSelectedValue(formValues.qualification, formValues.customQualification);
    const areaOfExpertise = resolveSelectedValue(formValues.areaOfExpertise, formValues.customAreaOfExpertise);
    const formData = new FormData();

    formData.append("fullName", trimValue(formValues.fullName));
    formData.append("email", trimValue(formValues.email));
    formData.append("pincode", trimValue(formValues.pincode));
    formData.append("membershipNumber", trimValue(formValues.membershipNumber));
    formData.append("cop", trimValue(formValues.cop));
    formData.append("qualification", qualification);
    formData.append("areaOfExpertise", areaOfExpertise);
    formData.append("profile", file);
    formData.append("g-recaptcha-response", captchaToken);

    return formData;
  };

  const handleRetrySubmission = () => {
    if (loading) return;
    setShowErrorBanner(false);
    formRef.current?.requestSubmit();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setSubmitAttempted(true);
    setShowErrorBanner(false);
    setSuccessMessage("");
    setErrorMessage("");

    const validationErrors = validateForm(values, profileFile, captchaToken);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      scrollToFirstInvalidField(validationErrors);

      const validationMessage =
        validationErrors.profile ||
        validationErrors.email ||
        validationErrors.fullName ||
        validationErrors.membershipNumber ||
        validationErrors.pincode ||
        "Please review the highlighted onboarding fields.";
      toast.warning(validationMessage);
      return;
    }

    if (!profileFile) {
      return;
    }

    const normalizedValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, trimValue(value)])
    ) as ExpertFormData;

    let activeToastId: string | number | undefined;

    try {
      setLoading(true);
      setSubmissionStage("verifying");
      activeToastId = toast.loading(PHASE_MESSAGES.verifying);

      setErrors((prev) => ({
        ...prev,
        captcha: "",
      }));

      setSubmissionStage("uploading");
      toast.loading(PHASE_MESSAGES.uploading, { id: activeToastId });

      const formData = buildMultipartPayload(normalizedValues, profileFile, captchaToken);
      console.log("[JoinAsExpert] captchaToken", captchaToken);
      debugLog("Submitting expert onboarding form.", {
        url: EXPERT_ONBOARDING_WEBHOOK,
        fields: Array.from(formData.keys()),
        fileName: profileFile.name,
        fileSize: profileFile.size,
        captchaToken,
      });

      setSubmissionStage("submitting");
      toast.loading(PHASE_MESSAGES.submitting, { id: activeToastId });

      const abortController = new AbortController();
      const timeoutId = window.setTimeout(() => abortController.abort(), SUBMISSION_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(EXPERT_ONBOARDING_WEBHOOK, {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      const data = await safeParseJson(response);
      debugLog("Expert onboarding response received.", {
        status: response.status,
        ok: response.ok,
        body: data,
      });

      if (!response.ok || !data?.success) {
        if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
          setErrors(data.fieldErrors);
          scrollToFirstInvalidField(data.fieldErrors);
        }

        const apiMessage = trimValue(data?.message) || trimValue(data?.error);
        const apiCode = trimValue(data?.code);
        const recaptchaCodes = Array.isArray(data?.recaptchaCodes) ? data.recaptchaCodes : [];

        if (
          apiCode.startsWith("captcha") ||
          /captcha|security verification/i.test(apiMessage) ||
          recaptchaCodes.length > 0
        ) {
          const isExpired =
            apiCode === "captcha_expired" ||
            recaptchaCodes.includes("timeout-or-duplicate") ||
            recaptchaCodes.includes("invalid-input-response");

          throw new Error(
            isExpired
              ? "Security verification expired. Please complete the CAPTCHA again."
              : trimValue(data?.fieldErrors?.captcha) || "Security verification failed. Please try again."
          );
        }
        if (/file|upload|resume|document/i.test(apiMessage)) {
          throw new Error("Upload failure. Please reattach your resume and retry.");
        }

        throw new Error(apiMessage || FALLBACK_SUBMISSION_ERROR);
      }

      setSubmissionStage("finalizing");
      toast.loading(PHASE_MESSAGES.finalizing, { id: activeToastId });

      setSuccessMessage(SUCCESS_MESSAGE);
      setSubmittedName(normalizedValues.fullName);
      setValues(initialValues);
      setProfileFile(null);
      setErrors({});
      setShowErrorBanner(false);
      setErrorMessage("");
      setCaptchaStatus("idle");
      setSubmitAttempted(false);

      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }

      refreshCaptchaWidget("idle");
      toast.success(SUCCESS_MESSAGE, { id: activeToastId });
    } catch (error) {
      debugLog("Expert onboarding submission failed.", error);

      const message = resolveSubmissionErrorMessage(error);
      setErrorMessage(message);
      setShowErrorBanner(true);
      setSubmissionStage("idle");

      const nextErrors: Partial<Record<ExpertFormFieldKey, string>> = {
        captcha: /captcha|security verification/i.test(message) ? message : CAPTCHA_RETRY_MESSAGE,
      };
      if (/resume missing|invalid file format|large file upload|upload failure/i.test(message)) {
        nextErrors.profile = message;
      }
      setErrors((prev) => ({
        ...prev,
        ...nextErrors,
      }));

      refreshCaptchaWidget(/could not be loaded/i.test(message) ? "error" : "expired");
      toast.error(message, { id: activeToastId });
    } finally {
      setLoading(false);
      setSubmissionStage("idle");
    }
  };

  const submitButtonLabel = loading ? "Submitting Secure Application..." : "Submit Secure Application";
  const submissionStatusMessage =
    submissionStage === "idle"
      ? "Every application is encrypted in transit and reviewed through our controlled expert onboarding workflow."
      : PHASE_MESSAGES[submissionStage];
  const isCaptchaVerified = Boolean(captchaToken) && captchaStatus === "verified";
  const isSubmitDisabled = loading || !isCaptchaVerified || !RECAPTCHA_SITE_KEY;
  const showSuccess = Boolean(successMessage);

  return (
    <div
      className={
        IS_IOS_NATIVE_APP
          ? "nritax-ios-join-page overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_38%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_48%,#e2e8f0_100%)] font-sans text-slate-950"
          : "overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_35%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_46%,#e2e8f0_100%)] py-10 font-sans text-slate-950"
      }
    >
      <Toaster position="top-right" richColors closeButton />
      {IS_IOS_NATIVE_APP ? (
        <style>
          {`
            .nritax-ios-join-page {
              width: 100%;
              max-width: 100vw;
              padding: calc(8px + env(safe-area-inset-top)) 0 calc(84px + env(safe-area-inset-bottom));
              box-sizing: border-box;
            }
            .nritax-ios-join-page * {
              box-sizing: border-box;
              max-width: 100%;
            }
            .nritax-ios-join-page input,
            .nritax-ios-join-page select,
            .nritax-ios-join-page button {
              min-width: 0;
            }
            .nritax-ios-join-page iframe {
              max-width: calc(100vw - 56px) !important;
              transform-origin: left top;
            }
          `}
        </style>
      ) : null}

      <div className={IS_IOS_NATIVE_APP ? "mx-auto w-full max-w-full px-3" : "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm backdrop-blur transition hover:border-sky-300 hover:bg-white"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className={IS_IOS_NATIVE_APP ? "mb-5 w-full max-w-full" : "mb-10 max-w-4xl"}>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">Expert Onboarding</p>
          <h1 className={IS_IOS_NATIVE_APP ? "mt-3 text-3xl font-semibold text-slate-950" : "mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"}>
            Secure expert onboarding for NRITAX.AI
          </h1>
          <p className={IS_IOS_NATIVE_APP ? "mt-3 text-sm leading-6 text-slate-700" : "mt-4 max-w-3xl text-base leading-7 text-slate-700 sm:text-lg"}>
            Submit your professional profile through our trusted onboarding system for high-confidence tax and compliance engagements.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/70 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur">
              <LockKeyhole className="size-4 text-sky-700" />
              256-bit encrypted submission
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/70 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur">
              <FileCheck2 className="size-4 text-sky-700" />
              Secure document processing
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/70 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur">
              <ShieldCheck className="size-4 text-sky-700" />
              Trusted onboarding system
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border border-white/60 bg-white/72 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <CardHeader className={IS_IOS_NATIVE_APP ? "px-4 py-5" : "border-b border-slate-200/70 px-6 py-7 sm:px-8"}>
            <CardTitle className={IS_IOS_NATIVE_APP ? "text-xl text-slate-950" : "text-2xl font-semibold text-slate-950"}>
              Expert Registration Form
            </CardTitle>
            <CardDescription className="max-w-2xl text-slate-600">
              Share your profile, credentials, and onboarding details. Every secure submission is routed directly to the live NRITAX expert onboarding workflow.
            </CardDescription>
          </CardHeader>

          <CardContent className={IS_IOS_NATIVE_APP ? "px-4 pb-5 pt-5" : "px-6 pb-8 pt-6 sm:px-8"}>
            {showSuccess ? (
              <div className="rounded-[24px] border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(219,234,254,0.88))] p-6 shadow-[0_20px_45px_rgba(16,185,129,0.10)]">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-emerald-600/10 p-3 text-emerald-700">
                    <CheckCircle2 className="size-7" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-emerald-950">{successMessage}</p>
                    <p className="mt-3 text-sm leading-6 text-emerald-900">
                      Hi {submittedName || "there"}, your expert profile is now with the NRITAX.AI onboarding team.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-emerald-900">
                      We&apos;ll review your qualifications, process your documents securely, and reach out with next steps.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {showErrorBanner ? (
                  <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-4 text-sm text-rose-800 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-rose-600" />
                      <span>{errorMessage || FALLBACK_SUBMISSION_ERROR}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRetrySubmission}
                      disabled={loading}
                      className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                    >
                      Retry Secure Submission
                    </Button>
                  </div>
                ) : null}

                <form ref={formRef} onSubmit={handleSubmit} className={IS_IOS_NATIVE_APP ? "w-full max-w-full space-y-5" : "space-y-8"} noValidate>
                  <div className={IS_IOS_NATIVE_APP ? "grid w-full max-w-full grid-cols-1 gap-4" : "grid gap-5 md:grid-cols-2"}>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium text-slate-900">Full Name {requiredAsterisk}</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        ref={setFieldRef("fullName") as never}
                        required
                        value={values.fullName}
                        onChange={handleChange}
                        aria-invalid={errors.fullName ? true : undefined}
                        aria-describedby={errors.fullName ? getFieldErrorId("fullName") : undefined}
                        placeholder="Enter your full name"
                        className={getFieldClassName("fullName", formFieldClassName)}
                        disabled={loading}
                      />
                      {errors.fullName ? <p id={getFieldErrorId("fullName")} className={errorMessageClassName}>{errors.fullName}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-slate-900">Email {requiredAsterisk}</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        ref={setFieldRef("email") as never}
                        required
                        value={values.email}
                        onChange={handleChange}
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={errors.email ? getFieldErrorId("email") : undefined}
                        placeholder="Enter your email address"
                        className={getFieldClassName("email", formFieldClassName)}
                        disabled={loading}
                      />
                      {errors.email ? <p id={getFieldErrorId("email")} className={errorMessageClassName}>{errors.email}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pincode" className="text-sm font-medium text-slate-900">Pincode {requiredAsterisk}</Label>
                      <Input
                        id="pincode"
                        name="pincode"
                        type="text"
                        inputMode="numeric"
                        ref={setFieldRef("pincode") as never}
                        required
                        value={values.pincode}
                        onChange={handleChange}
                        aria-invalid={errors.pincode ? true : undefined}
                        aria-describedby={errors.pincode ? getFieldErrorId("pincode") : undefined}
                        placeholder="Enter your 6-digit pincode"
                        className={getFieldClassName("pincode", formFieldClassName)}
                        disabled={loading}
                      />
                      {errors.pincode ? <p id={getFieldErrorId("pincode")} className={errorMessageClassName}>{errors.pincode}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="membershipNumber" className="text-sm font-medium text-slate-900">Membership Number {requiredAsterisk}</Label>
                      <Input
                        id="membershipNumber"
                        name="membershipNumber"
                        ref={setFieldRef("membershipNumber") as never}
                        required
                        value={values.membershipNumber}
                        onChange={handleChange}
                        aria-invalid={errors.membershipNumber ? true : undefined}
                        aria-describedby={errors.membershipNumber ? getFieldErrorId("membershipNumber") : undefined}
                        placeholder="Enter your membership number"
                        className={getFieldClassName("membershipNumber", formFieldClassName)}
                        disabled={loading}
                      />
                      {errors.membershipNumber ? (
                        <p id={getFieldErrorId("membershipNumber")} className={errorMessageClassName}>{errors.membershipNumber}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cop" className="text-sm font-medium text-slate-900">COP {requiredAsterisk}</Label>
                      <div className="relative" ref={setFieldRef("cop") as never}>
                        <select
                          id="cop"
                          name="cop"
                          required
                          value={values.cop}
                          onChange={handleChange}
                          aria-invalid={errors.cop ? true : undefined}
                          aria-describedby={errors.cop ? getFieldErrorId("cop") : undefined}
                          className={getFieldClassName("cop", formSelectClassName)}
                          disabled={loading}
                        >
                          <option value="">Select COP status</option>
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Not Applicable">Not Applicable</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                      </div>
                      {errors.cop ? <p id={getFieldErrorId("cop")} className={errorMessageClassName}>{errors.cop}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="qualification" className="text-sm font-medium text-slate-900">Qualification {requiredAsterisk}</Label>
                      <div className="relative" ref={setFieldRef("qualification") as never}>
                        <select
                          id="qualification"
                          name="qualification"
                          required
                          value={values.qualification}
                          onChange={handleChange}
                          aria-invalid={errors.qualification ? true : undefined}
                          aria-describedby={errors.qualification ? getFieldErrorId("qualification") : undefined}
                          className={getFieldClassName("qualification", formSelectClassName)}
                          disabled={loading}
                        >
                          <option value="">Select qualification</option>
                          <option value="Chartered Accountant (CA)">Chartered Accountant (CA)</option>
                          <option value="CPA">CPA</option>
                          <option value="Tax Advisor">Tax Advisor</option>
                          <option value="Lawyer">Lawyer</option>
                          <option value="Other">Other</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                      </div>
                      {values.qualification === "Other" ? (
                        <Input
                          id="customQualification"
                          name="customQualification"
                          value={values.customQualification}
                          onChange={handleChange}
                          aria-invalid={errors.qualification ? true : undefined}
                          aria-describedby={errors.qualification ? getFieldErrorId("qualification") : undefined}
                          placeholder="Enter your qualification"
                          disabled={loading}
                          className={getFieldClassName("qualification", formFieldClassName)}
                        />
                      ) : null}
                      {errors.qualification ? <p id={getFieldErrorId("qualification")} className={errorMessageClassName}>{errors.qualification}</p> : null}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="areaOfExpertise" className="text-sm font-medium text-slate-900">Area of Expertise {requiredAsterisk}</Label>
                      <div className="relative" ref={setFieldRef("areaOfExpertise") as never}>
                        <select
                          id="areaOfExpertise"
                          name="areaOfExpertise"
                          required
                          value={values.areaOfExpertise}
                          onChange={handleChange}
                          aria-invalid={errors.areaOfExpertise ? true : undefined}
                          aria-describedby={errors.areaOfExpertise ? getFieldErrorId("areaOfExpertise") : undefined}
                          className={getFieldClassName("areaOfExpertise", formSelectClassName)}
                          disabled={loading}
                        >
                          <option value="">Select area of expertise</option>
                          <option value="DTAA">DTAA</option>
                          <option value="FEMA">FEMA</option>
                          <option value="NRI Tax Filing">NRI Tax Filing</option>
                          <option value="Capital Gains">Capital Gains</option>
                          <option value="Property Tax">Property Tax</option>
                          <option value="TDS Refund">TDS Refund</option>
                          <option value="Compliance">Compliance</option>
                          <option value="Other">Other</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                      </div>
                      {values.areaOfExpertise === "Other" ? (
                        <Input
                          id="customAreaOfExpertise"
                          name="customAreaOfExpertise"
                          value={values.customAreaOfExpertise}
                          onChange={handleChange}
                          aria-invalid={errors.areaOfExpertise ? true : undefined}
                          aria-describedby={errors.areaOfExpertise ? getFieldErrorId("areaOfExpertise") : undefined}
                          placeholder="Enter your area of expertise"
                          disabled={loading}
                          className={getFieldClassName("areaOfExpertise", formFieldClassName)}
                        />
                      ) : null}
                      {errors.areaOfExpertise ? (
                        <p id={getFieldErrorId("areaOfExpertise")} className={errorMessageClassName}>{errors.areaOfExpertise}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="profile" className="text-sm font-medium text-slate-900">Profile {requiredAsterisk}</Label>
                      <div
                        ref={setFieldRef("profile") as never}
                        className={`rounded-[22px] border border-dashed bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.88))] p-5 shadow-inner transition duration-200 ${errors.profile ? "border-rose-400" : "border-sky-200/80"}`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Secure resume upload</p>
                            <p className="mt-1 text-xs text-slate-600">PDF, DOC, or DOCX only. Maximum file size: 10 MB.</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2 rounded-xl border-sky-200 bg-white/90 text-sky-800 hover:bg-sky-50"
                            onClick={() => resumeInputRef.current?.click()}
                            disabled={loading}
                          >
                            <Paperclip className="size-4" />
                            Choose File
                          </Button>
                        </div>

                        <input
                          id="profile"
                          name="profile"
                          ref={resumeInputRef}
                          type="file"
                          required
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={handleFileChange}
                          aria-invalid={errors.profile ? true : undefined}
                          aria-describedby={errors.profile ? getFieldErrorId("profile") : undefined}
                          disabled={loading}
                        />

                        {profileFile ? (
                          <div className="mt-4 flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-900 shadow-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{profileFile.name}</p>
                              <p className="mt-1 text-xs text-sky-700">{(profileFile.size / (1024 * 1024)).toFixed(2)} MB ready for secure processing</p>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveFile}
                              disabled={loading}
                              className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 transition hover:text-sky-950"
                            >
                              <X className="size-3.5" />
                              Remove
                            </button>
                          </div>
                        ) : null}

                        {errors.profile ? <p id={getFieldErrorId("profile")} className={errorMessageClassName}>{errors.profile}</p> : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.03),rgba(255,255,255,0.72))] p-5 shadow-inner">
                    <div
                      ref={setFieldRef("captcha") as never}
                      className={`rounded-2xl border px-4 py-4 transition duration-200 ${
                        errors.captcha
                          ? "border-rose-300 bg-rose-50/80 shadow-[0_12px_30px_rgba(244,63,94,0.10)]"
                          : captchaStatus === "verified"
                            ? "border-emerald-300 bg-emerald-50/80 shadow-[0_12px_30px_rgba(16,185,129,0.10)]"
                            : "border-sky-100 bg-white/85"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Security verification</p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            Complete the live Google verification checkpoint before transmitting sensitive onboarding records.
                          </p>
                        </div>
                        <div
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
                            captchaStatus === "verified"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : errors.captcha || captchaStatus === "error"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                          aria-live="polite"
                        >
                          {captchaStatus === "verified" ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : (
                            <ShieldCheck className="size-4 text-sky-700" />
                          )}
                          {captchaStatus === "verified"
                            ? "Identity verified"
                            : captchaStatus === "error"
                              ? "Verification interrupted"
                              : "Secure checkpoint pending"}
                        </div>
                      </div>

                      <div className="mt-4 min-h-[112px] rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-sm transition duration-200">
                        {RECAPTCHA_SITE_KEY ? (
                          <div className="max-w-full overflow-x-auto">
                            <div className="inline-block min-w-[304px]">
                              <ReCAPTCHA
                                key={captchaRenderKey}
                                ref={recaptchaRef}
                                sitekey={RECAPTCHA_SITE_KEY}
                                theme="light"
                                onChange={handleCaptchaChange}
                                onExpired={handleCaptchaExpired}
                                onErrored={handleCaptchaErrored}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            Security verification is unavailable because `VITE_RECAPTCHA_SITE_KEY` is not configured.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-col gap-2 text-xs leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                        <p>We use visible bot protection to keep expert intake accurate, compliant, and abuse-resistant.</p>
                        <p
                          className={`inline-flex items-center gap-2 font-medium transition ${
                            captchaStatus === "verified"
                              ? "text-emerald-700"
                              : captchaStatus === "expired" || captchaStatus === "error"
                                ? "text-rose-700"
                                : "text-slate-500"
                          }`}
                        >
                          {captchaStatus === "verified" ? <CheckCircle2 className="size-4" /> : <LockKeyhole className="size-4" />}
                          {captchaStatus === "verified"
                            ? `✓ ${CAPTCHA_VERIFIED_MESSAGE}`
                            : captchaStatus === "expired"
                              ? "Verification expired. Please complete it again."
                              : captchaStatus === "error"
                                ? "Verification could not load. Refresh and retry."
                                : "Complete the checkbox to enable submission."}
                        </p>
                      </div>

                      {errors.captcha ? <p id={getFieldErrorId("captcha")} className={errorMessageClassName}>{errors.captcha}</p> : null}
                    </div>

                    <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-sky-100 p-2 text-sky-700">
                          {loading ? <LoaderCircle className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {loading ? submitButtonLabel : "Trusted onboarding submission"}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {loading
                              ? submissionStatusMessage
                              : "Your details are reviewed by the NRITAX onboarding team before activation."}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="h-12 min-w-[220px] rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={isSubmitDisabled}
                      >
                        {loading ? (
                          <span className="inline-flex items-center gap-2">
                            <LoaderCircle className="size-4 animate-spin" />
                            {submitButtonLabel}
                          </span>
                        ) : (
                          "Submit Secure Application"
                        )}
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">256-bit encrypted submission</div>
                      <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">Secure document processing</div>
                      <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">Trusted onboarding system</div>
                    </div>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default JoinAsExpertPage;
