import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Paperclip, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { trimValue } from "../utils/consultationWorkflow";

type ExpertFormData = {
  fullName: string;
  email: string;
  pincode: string;
  membershipNumber: string;
  cop: string;
  qualification: string;
  areaOfExpertise: string;
};

type FieldKey = keyof ExpertFormData;
type ExpertFormFieldKey = FieldKey | "profile" | "captcha";

type ExpertOnboardingResponse = {
  success?: boolean;
  message?: string;
};

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => number;
      reset: (widgetId?: number) => void;
      ready: (callback: () => void) => void;
    };
  }
}

const initialValues: ExpertFormData = {
  fullName: "",
  email: "",
  pincode: "",
  membershipNumber: "",
  cop: "",
  qualification: "",
  areaOfExpertise: "",
};

const SUBMISSION_TIMEOUT_MS = 15000;
const FALLBACK_SUBMISSION_ERROR = "Submission failed. Please try again.";
const EXPERT_ONBOARDING_SUBMIT_URL = "https://n8n.caloganathan.com/webhook/expert-onboarding";
const RECAPTCHA_SITE_KEY = "PASTE_MY_RECAPTCHA_V2_SITE_KEY_HERE";
const RECAPTCHA_SCRIPT_ID = "google-recaptcha-v2-script";
const REQUIRED_FIELDS: FieldKey[] = [
  "fullName",
  "email",
  "pincode",
  "membershipNumber",
  "cop",
  "qualification",
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

  if (!trimmedBody) {
    return null;
  }

  try {
    return JSON.parse(trimmedBody) as ExpertOnboardingResponse;
  } catch {
    return {
      message: trimmedBody,
    };
  }
};

export function JoinAsExpertPage() {
  const navigate = useNavigate();
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<ExpertFormData>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<ExpertFormFieldKey, string>>>({});
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);

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

      recaptchaWidgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token: string) => {
          setCaptchaToken(token || "");
          setErrors((prev) => ({
            ...prev,
            captcha: "",
          }));
          setShowErrorBanner(false);
        },
        "expired-callback": () => {
          setCaptchaToken("");
        },
        "error-callback": () => {
          setCaptchaToken("");
        },
      });
    };

    const existingScript = document.getElementById(RECAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.grecaptcha) {
        window.grecaptcha.ready(renderRecaptcha);
      } else {
        existingScript.addEventListener("load", renderRecaptcha, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderRecaptcha, { once: true });
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", renderRecaptcha);
    };
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let nextValue = value;

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
    setProfileFile(file);
    setShowErrorBanner(false);
    setErrorMessage("");
    setErrors((prev) => ({
      ...prev,
      profile: "",
    }));
  };

  const handleRemoveFile = () => {
    setProfileFile(null);
    setErrorMessage("");
    if (resumeInputRef.current) {
      resumeInputRef.current.value = "";
    }
  };

  const validateForm = (formValues: ExpertFormData, file: File | null) => {
    const newErrors: Partial<Record<ExpertFormFieldKey, string>> = {};

    if (!formValues.fullName || formValues.fullName.trim() === "") {
      newErrors.fullName = "Full name is required";
    }

    if (!formValues.email || !/^\S+@\S+\.\S+$/.test(formValues.email.trim())) {
      newErrors.email = "Enter a valid email address";
    }

    if (!formValues.pincode || !/^\d{6}$/.test(formValues.pincode.trim())) {
      newErrors.pincode = "Enter a valid 6-digit pincode";
    }

    if (!formValues.membershipNumber || formValues.membershipNumber.trim() === "") {
      newErrors.membershipNumber = "Membership number is required";
    }

    if (!["Active", "Inactive", "Not Applicable"].includes(formValues.cop.trim())) {
      newErrors.cop = "Please select COP.";
    }

    if (!formValues.qualification || formValues.qualification.trim() === "") {
      newErrors.qualification = "Please select qualification.";
    }

    if (!formValues.areaOfExpertise || formValues.areaOfExpertise.trim() === "") {
      newErrors.areaOfExpertise = "Please select area of expertise.";
    }

    if (!file) {
      newErrors.profile = "Please upload your profile.";
    }

    if (!captchaToken) {
      newErrors.captcha = "Please complete the CAPTCHA.";
    }

    return newErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowErrorBanner(false);
    setSuccessMessage("");
    setErrorMessage("");

    if (loading) return;

    const validationErrors = validateForm(values, profileFile);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setErrorMessage(
        validationErrors.profile || validationErrors.captcha || "Please fill all required fields."
      );
      setShowErrorBanner(true);
      return;
    }

    setErrors({});
    setShowErrorBanner(false);
    setLoading(true);

    try {
      const normalizedValues = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()])
      ) as ExpertFormData;

      if (!normalizedValues.fullName) throw new Error("Please enter full name.");
      if (!normalizedValues.email) throw new Error("Please enter email.");
      if (!normalizedValues.pincode) throw new Error("Please enter pincode.");
      if (!normalizedValues.membershipNumber) throw new Error("Please enter membership number.");
      if (!normalizedValues.cop) throw new Error("Please select COP.");
      if (!normalizedValues.qualification) throw new Error("Please select qualification.");
      if (!normalizedValues.areaOfExpertise) throw new Error("Please select area of expertise.");
      if (!captchaToken) throw new Error("Please complete the CAPTCHA.");
      if (!profileFile) throw new Error("Please upload your profile.");

      const formData = new FormData();
      formData.append("fullName", normalizedValues.fullName || "");
      formData.append("email", normalizedValues.email || "");
      formData.append("pincode", normalizedValues.pincode || "");
      formData.append("membershipNumber", normalizedValues.membershipNumber || "");
      formData.append("cop", normalizedValues.cop || "");
      formData.append("qualification", normalizedValues.qualification || "");
      formData.append("areaOfExpertise", normalizedValues.areaOfExpertise || "");
      formData.append("profile", profileFile);
      formData.append("g-recaptcha-response", captchaToken);

      console.log("Submitting form...");
      for (const pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }

      debugLog("Submitting expert onboarding form.", {
        url: EXPERT_ONBOARDING_SUBMIT_URL,
        requiredFields: REQUIRED_FIELDS,
        hasProfile: true,
        hasRecaptchaToken: Boolean(captchaToken),
        formKeys: Array.from(formData.keys()),
      });

      const abortController = new AbortController();
      const timeoutId = window.setTimeout(() => abortController.abort(), SUBMISSION_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(EXPERT_ONBOARDING_SUBMIT_URL, {
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

      console.log("submit response:", data);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || FALLBACK_SUBMISSION_ERROR);
      }

      setSuccessMessage(data.message || "Application submitted successfully.");
      setValues(initialValues);
      setProfileFile(null);
      setCaptchaToken("");
      setErrors({});
      setShowErrorBanner(false);
      setErrorMessage("");
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
      if (window.grecaptcha && recaptchaWidgetIdRef.current !== null) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
    } catch (error) {
      debugLog("Expert onboarding submission failed.", error);
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setErrorMessage(message);
      setShowErrorBanner(true);
      setCaptchaToken("");
      if (window.grecaptcha && recaptchaWidgetIdRef.current !== null) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-10 font-sans text-[#0F172A]">
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

        <Card className="border border-[#E2E8F0] bg-[#F7FAFC] font-sans shadow-xl">
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
                  <Label htmlFor="fullName" className="text-sm font-medium text-[#0F172A]">Full Name *</Label>
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
                  <Label htmlFor="email" className="text-sm font-medium text-[#0F172A]">Email *</Label>
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
                  <Label htmlFor="pincode" className="text-sm font-medium text-[#0F172A]">Pincode *</Label>
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
                  <Label htmlFor="membershipNumber" className="text-sm font-medium text-[#0F172A]">Membership Number *</Label>
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
                  <Label htmlFor="cop" className="text-sm font-medium text-[#0F172A]">COP *</Label>
                  <select
                    id="cop"
                    name="cop"
                    required
                    value={values.cop}
                    onChange={handleChange}
                    aria-invalid={errors.cop ? true : undefined}
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={loading}
                  >
                    <option value="">Select COP status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Not Applicable">Not Applicable</option>
                  </select>
                  {errors.cop ? <p className="text-sm text-red-600">{errors.cop}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualification" className="text-sm font-medium text-[#0F172A]">Qualification *</Label>
                  <select
                    id="qualification"
                    name="qualification"
                    required
                    value={values.qualification}
                    onChange={handleChange}
                    aria-invalid={errors.qualification ? true : undefined}
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={loading}
                  >
                    <option value="">Select qualification</option>
                    <option value="Chartered Accountant (CA)">Chartered Accountant (CA)</option>
                    <option value="CPA">CPA</option>
                    <option value="Tax Advisor">Tax Advisor</option>
                    <option value="Lawyer">Lawyer</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.qualification ? <p className="text-sm text-red-600">{errors.qualification}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="areaOfExpertise" className="text-sm font-medium text-[#0F172A]">Area of Expertise *</Label>
                  <select
                    id="areaOfExpertise"
                    name="areaOfExpertise"
                    required
                    value={values.areaOfExpertise}
                    onChange={handleChange}
                    aria-invalid={errors.areaOfExpertise ? true : undefined}
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  {errors.areaOfExpertise ? (
                    <p className="text-sm text-red-600">{errors.areaOfExpertise}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile" className="text-sm font-medium text-[#0F172A]">Profile *</Label>
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Upload profile from desktop</p>
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
                      id="profile"
                      name="profile"
                      ref={resumeInputRef}
                      type="file"
                      required
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={handleFileChange}
                      aria-invalid={errors.profile ? true : undefined}
                      disabled={loading}
                    />
                    {profileFile ? (
                      <div className="mt-3 flex items-center justify-between rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#1D4ED8]">
                        <span className="truncate pr-3">{profileFile.name}</span>
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
                    {errors.profile ? <p className="mt-3 text-sm text-red-600">{errors.profile}</p> : null}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] pt-5">
                <div className="mb-4">
                  <div className="mt-3 rounded-xl border border-[#CBD5E1] bg-white px-4 py-4">
                    <div>
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Security Verification</p>
                        <p className="mt-1 text-xs text-[#0F172A]/70">Please complete the checkbox below to continue.</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div
                        id="recaptcha-container"
                        ref={recaptchaContainerRef}
                        className="g-recaptcha min-h-[78px]"
                        aria-invalid={errors.captcha ? true : undefined}
                      />
                    </div>
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
