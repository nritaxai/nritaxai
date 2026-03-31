import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Paperclip, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EXPERT_ONBOARDING_WEBHOOK, trimValue } from "../utils/consultationWorkflow";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      render: (
        container: string | HTMLElement,
        parameters: {
          sitekey: string;
        }
      ) => number;
      reset: () => void;
    };
  }
}

type ExpertFormData = {
  fullName: string;
  mobileNumber: string;
  email: string;
  pincode: string;
  membershipNumber: string;
  cop: string;
  profession: string;
  areaOfExpertise: string;
};

type FieldKey = keyof ExpertFormData;
type ExpertFormFieldKey = FieldKey | "resume" | "captcha";

const initialValues: ExpertFormData = {
  fullName: "",
  mobileNumber: "",
  email: "",
  pincode: "",
  membershipNumber: "",
  cop: "",
  profession: "",
  areaOfExpertise: "",
};

type ExpertOnboardingResponse = {
  success?: boolean;
  message?: string;
  resumeLink?: string;
};

const SUBMISSION_TIMEOUT_MS = 15000;
const FALLBACK_SUBMISSION_ERROR = "Submission failed. Please try again.";
const RECAPTCHA_SITE_KEY = "6Lc1Z58sAAAAAACGlun3wJokzZbtDFc_XrOAYfNk";
const REQUIRED_FIELDS: FieldKey[] = [
  "fullName",
  "mobileNumber",
  "email",
  "pincode",
  "membershipNumber",
  "cop",
  "profession",
  "areaOfExpertise",
];

const isDevelopment = import.meta.env.DEV;

const debugLog = (message: string, details?: unknown) => {
  if (!isDevelopment) return;

  if (details === undefined) {
    console.debug(`[JoinAsExpert] ${message}`);
    return;
  }

  console.debug(`[JoinAsExpert] ${message}`, details);
};

const parseResponseJsonSafely = async (response: Response): Promise<ExpertOnboardingResponse | null> => {
  const rawText = await response.text();
  const trimmedBody = rawText.trim();
  const contentType = response.headers.get("content-type") || "";

  if (!trimmedBody) {
    return null;
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return JSON.parse(trimmedBody) as ExpertOnboardingResponse;
  } catch {
    return null;
  }
};

const getSubmissionErrorMessage = (response: Response, payload: ExpertOnboardingResponse | null) => {
  const message = trimValue(payload?.message);

  if (message) {
    return message;
  }

  debugLog("Using fallback submission error message.", {
    status: response.status,
    contentType: response.headers.get("content-type"),
  });
  return FALLBACK_SUBMISSION_ERROR;
};

export function JoinAsExpertPage() {
  const navigate = useNavigate();
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);
  const [values, setValues] = useState<ExpertFormData>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<ExpertFormFieldKey, string>>>({});
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

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
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const renderRecaptcha = () => {
      if (!window.grecaptcha || !recaptchaContainerRef.current || recaptchaWidgetIdRef.current !== null) {
        return;
      }

      window.grecaptcha.ready(() => {
        if (!recaptchaContainerRef.current || recaptchaWidgetIdRef.current !== null) return;

        recaptchaWidgetIdRef.current = window.grecaptcha?.render(recaptchaContainerRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
        }) ?? null;
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.google.com/recaptcha/api.js"]');
    if (existingScript) {
      if (window.grecaptcha) {
        renderRecaptcha();
      } else {
        existingScript.addEventListener("load", renderRecaptcha, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.src = "https://www.google.com/recaptcha/api.js";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderRecaptcha, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      existingScript?.removeEventListener("load", renderRecaptcha);
    };
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === "mobileNumber") {
      nextValue = value.replace(/\D/g, "").slice(0, 10);
    }

    if (name === "pincode") {
      nextValue = value.replace(/\D/g, "").slice(0, 6);
    }

    setValues((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));

    setShowErrorBanner(false);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setResumeFile(file);
    setShowErrorBanner(false);
    setErrorMessage("");
    setErrors((prev) => ({
      ...prev,
      resume: "",
    }));
  };

  const handleRemoveFile = () => {
    setResumeFile(null);
    setErrorMessage("");
    if (resumeInputRef.current) {
      resumeInputRef.current.value = "";
    }
  };

  const validateForm = (values: ExpertFormData, file: File | null) => {
    const newErrors: Partial<Record<ExpertFormFieldKey, string>> = {};

    if (!values.fullName || values.fullName.trim() === "") {
      newErrors.fullName = "Full name is required";
    }

    if (!values.mobileNumber || !/^\d{10}$/.test(values.mobileNumber.trim())) {
      newErrors.mobileNumber = "Enter a valid 10-digit mobile number";
    }

    if (!values.email || !/^\S+@\S+\.\S+$/.test(values.email.trim())) {
      newErrors.email = "Enter a valid email address";
    }

    if (!values.pincode || !/^\d{6}$/.test(values.pincode.trim())) {
      newErrors.pincode = "Enter a valid 6-digit pincode";
    }

    if (!values.membershipNumber || values.membershipNumber.trim() === "") {
      newErrors.membershipNumber = "Membership number is required";
    }

    if (!["Yes", "No"].includes(values.cop.trim())) {
      newErrors.cop = "Please select Yes or No";
    }

    if (!values.profession || values.profession.trim() === "") {
      newErrors.profession = "Profession is required";
    }

    if (!values.areaOfExpertise || values.areaOfExpertise.trim() === "") {
      newErrors.areaOfExpertise = "Area of expertise is required";
    }

    if (!file) {
      newErrors.resume = "Please upload your resume.";
    }

    return newErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowErrorBanner(false);
    setSuccessMessage("");
    setErrorMessage("");

    if (loading) return;

    const validationErrors = validateForm(values, resumeFile);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setErrorMessage(
        validationErrors.resume || validationErrors.captcha || "Please fill all required fields."
      );
      setShowErrorBanner(true);
      return;
    }

    setErrors({});
    setShowErrorBanner(false);
    setLoading(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const normalizedValues = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()])
      ) as ExpertFormData;

      for (const key of REQUIRED_FIELDS) {
        if (!normalizedValues[key]) {
          setErrors((prev) => ({
            ...prev,
            [key]: "This field is required",
          }));
          setErrorMessage("Please fill all required fields.");
          setShowErrorBanner(true);
          setLoading(false);
          return;
        }
      }

      for (const [key, value] of Object.entries(normalizedValues)) {
        formData.set(key, value);
      }

      if (resumeFile) {
        formData.set("resume", resumeFile);
      }

      const captchaToken = trimValue(String(formData.get("g-recaptcha-response") || ""));
      if (!captchaToken) {
        setErrors((prev) => ({
          ...prev,
          captcha: "Please complete the CAPTCHA.",
        }));
        setErrorMessage("Please complete the CAPTCHA.");
        setShowErrorBanner(true);
        setLoading(false);
        return;
      }

      debugLog("Submitting expert onboarding form.", {
        url: EXPERT_ONBOARDING_WEBHOOK,
        requiredFields: REQUIRED_FIELDS,
        hasResume: true,
        hasRecaptchaToken: Boolean(captchaToken),
        formKeys: Array.from(formData.keys()),
      });

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

      const data = await parseResponseJsonSafely(response);

      debugLog("Expert onboarding response received.", {
        status: response.status,
        ok: response.ok,
        body: data,
      });

      if (response.ok && data?.success) {
        setSuccessMessage(data.message || "Your application has been submitted successfully.");
        setValues(initialValues);
        setResumeFile(null);
        setErrors({});
        setShowErrorBanner(false);
        setErrorMessage("");
        if (resumeInputRef.current) {
          resumeInputRef.current.value = "";
        }
        window.grecaptcha?.reset();
      } else {
        setErrorMessage(getSubmissionErrorMessage(response, data));
        setShowErrorBanner(true);
        window.grecaptcha?.reset();
      }
    } catch (error) {
      debugLog("Expert onboarding submission failed.", error);
      setErrorMessage(FALLBACK_SUBMISSION_ERROR);
      setShowErrorBanner(true);
      window.grecaptcha?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563eb] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2563eb]">Expert Onboarding</p>
          <h1 className="mt-2 text-3xl text-[#0F172A] sm:text-4xl">Join Our Expert Team</h1>
          <p className="mt-3 text-base leading-7 text-[#0F172A]">
            Join NRITAX as a Chartered Accountant or expert and help NRI users with tax and compliance services.
          </p>
        </div>

        <Card className="border border-[#E2E8F0] bg-[#F7FAFC] shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-[#0F172A]">Expert Registration Form</CardTitle>
            <CardDescription className="text-[#0F172A]">
              Share your profile so our team can evaluate your fit for NRITAX expert onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {successMessage ? (
              <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800">
                <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{successMessage}</p>
                    <p className="mt-1 text-sm">
                      Thank you for applying as an expert. Our team will contact you soon.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {showErrorBanner && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage || "Please fill all required fields."}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    required
                    value={values.fullName}
                    onChange={handleChange}
                    aria-invalid={errors.fullName ? true : undefined}
                    placeholder="Enter your full name"
                  />
                  {errors.fullName ? <p className="text-sm text-red-600">{errors.fullName}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobileNumber">Mobile Number *</Label>
                  <Input
                    id="mobileNumber"
                    name="mobileNumber"
                    type="tel"
                    inputMode="numeric"
                    required
                    value={values.mobileNumber}
                    onChange={handleChange}
                    aria-invalid={errors.mobileNumber ? true : undefined}
                    placeholder="Enter your mobile number"
                  />
                  {errors.mobileNumber ? <p className="text-sm text-red-600">{errors.mobileNumber}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={values.email}
                    onChange={handleChange}
                    aria-invalid={errors.email ? true : undefined}
                    placeholder="Enter your email address"
                  />
                  {errors.email ? <p className="text-sm text-red-600">{errors.email}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    type="text"
                    inputMode="numeric"
                    required
                    value={values.pincode}
                    onChange={handleChange}
                    aria-invalid={errors.pincode ? true : undefined}
                    placeholder="Enter your 6-digit pincode"
                  />
                  {errors.pincode ? <p className="text-sm text-red-600">{errors.pincode}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="membershipNumber">Membership Number *</Label>
                  <Input
                    id="membershipNumber"
                    name="membershipNumber"
                    required
                    value={values.membershipNumber}
                    onChange={handleChange}
                    aria-invalid={errors.membershipNumber ? true : undefined}
                    placeholder="Enter your membership number"
                  />
                  {errors.membershipNumber ? (
                    <p className="text-sm text-red-600">{errors.membershipNumber}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cop">COP *</Label>
                  <select
                    id="cop"
                    name="cop"
                    required
                    value={values.cop}
                    onChange={handleChange}
                    aria-invalid={errors.cop ? true : undefined}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={loading}
                  >
                    <option value="">Select COP status</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                  {errors.cop ? <p className="text-sm text-red-600">{errors.cop}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profession">Profession *</Label>
                  <Input
                    id="profession"
                    name="profession"
                    required
                    value={values.profession}
                    onChange={handleChange}
                    aria-invalid={errors.profession ? true : undefined}
                    placeholder="CA, CPA, Tax Advisor, Lawyer..."
                  />
                  {errors.profession ? <p className="text-sm text-red-600">{errors.profession}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="areaOfExpertise">Area of Expertise *</Label>
                  <Input
                    id="areaOfExpertise"
                    name="areaOfExpertise"
                    required
                    value={values.areaOfExpertise}
                    onChange={handleChange}
                    aria-invalid={errors.areaOfExpertise ? true : undefined}
                    placeholder="DTAA, FEMA, NRI filing, property tax, capital gains..."
                  />
                  {errors.areaOfExpertise ? (
                    <p className="text-sm text-red-600">{errors.areaOfExpertise}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resume">Resume *</Label>
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Upload resume from desktop</p>
                        <p className="text-xs text-[#0F172A]/70">Accepted formats: PDF, DOC, DOCX</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => resumeInputRef.current?.click()}
                        disabled={loading}
                      >
                        <Paperclip className="size-4" />
                        Choose File
                      </Button>
                    </div>
                    <input
                      id="resume"
                      name="resume"
                      ref={resumeInputRef}
                      type="file"
                      required
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={handleFileChange}
                      aria-invalid={errors.resume ? true : undefined}
                      disabled={loading}
                    />
                    {resumeFile ? (
                      <div className="mt-3 flex items-center justify-between rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#1D4ED8]">
                        <span className="truncate pr-3">{resumeFile.name}</span>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          disabled={loading}
                          className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                        >
                          <X className="size-3.5" />
                          Remove
                        </button>
                      </div>
                    ) : null}
                    {errors.resume ? <p className="mt-3 text-sm text-red-600">{errors.resume}</p> : null}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] pt-5">
                <div className="mb-4">
                  <div style={{ margin: "16px 0" }}>
                    <div id="recaptcha-container" ref={recaptchaContainerRef} />
                  </div>
                  {errors.captcha ? <p className="mt-3 text-sm text-red-600">{errors.captcha}</p> : null}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="submit" className="h-11 px-6" disabled={loading}>
                    {loading ? "Submitting..." : "Submit Application"}
                  </Button>
                  <p className="text-sm text-[#0F172A]">
                    Your details will be reviewed by our team before onboarding.
                  </p>
                </div>
                <p className="mt-3 text-sm text-[#0F172A]/80">
                  Your information is secure and used only for onboarding purposes.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default JoinAsExpertPage;
