import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, Paperclip, X } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { trimValue } from "../utils/consultationWorkflow";
import { IS_IOS_NATIVE_APP } from "../../config/appConfig";
import { buildApiUrl } from "../../utils/api";

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

type ExpertOnboardingResponse = {
  success?: boolean;
  message?: string;
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

const SUBMISSION_TIMEOUT_MS = 15000;
const FALLBACK_SUBMISSION_ERROR = "Submission failed. Please try again.";
const SUBMIT_URL = buildApiUrl("/api/expert-onboarding/submit");
const RECAPTCHA_SITE_KEY = "6Lf88KIsAAAAAP-460OSQoWiiSIjmRllj644V3tW";
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

const resolveSelectedValue = (value: string, customValue: string) =>
  value === "Other" ? customValue.trim() : value.trim();

const formFieldClassName =
  "min-h-[44px] w-full rounded-[6px] border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#9CA3AF] outline-none transition focus-visible:border-[#3B82F6] focus-visible:ring-[3px] focus-visible:ring-[rgba(59,130,246,0.15)]";

const formSelectClassName =
  "min-h-[44px] w-full appearance-none rounded-[6px] border border-[#D1D5DB] bg-white px-4 py-3 pr-11 text-sm text-[#0F172A] outline-none transition focus-visible:border-[#3B82F6] focus-visible:ring-[3px] focus-visible:ring-[rgba(59,130,246,0.15)]";
const invalidFieldClassName = "border-[#DC2626] focus-visible:border-[#DC2626] focus-visible:ring-[rgba(220,38,38,0.15)]";
const errorMessageClassName = "mt-1 text-[12px] text-[#DC2626]";

const requiredAsterisk = <span className="text-red-500">*</span>;

export function JoinAsExpertPage() {
  const navigate = useNavigate();
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);
  const [values, setValues] = useState<ExpertFormData>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<ExpertFormFieldKey, string>>>({});
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const fieldRefs = useRef<Partial<Record<ExpertFormFieldKey, HTMLElement | null>>>({});

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

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === "pincode") {
      nextValue = value.replace(/\D/g, "").slice(0, 6);
    }

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
  };

  const setFieldRef = (field: ExpertFormFieldKey) => (element: HTMLElement | null) => {
    fieldRefs.current[field] = element;
  };

  const getFieldErrorId = (field: ExpertFormFieldKey) => `${field}-error`;

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

  const getFieldClassName = (field: ExpertFormFieldKey, baseClassName: string) =>
    errors[field] ? `${baseClassName} ${invalidFieldClassName}` : baseClassName;

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
    setErrors((prev) => ({
      ...prev,
      profile: "",
    }));
    if (resumeInputRef.current) {
      resumeInputRef.current.value = "";
    }
  };

  const validateForm = (formValues: ExpertFormData, file: File | null) => {
    const newErrors: Partial<Record<ExpertFormFieldKey, string>> = {};
    const email = formValues.email.trim();
    const qualification = resolveSelectedValue(formValues.qualification, formValues.customQualification);
    const areaOfExpertise = resolveSelectedValue(formValues.areaOfExpertise, formValues.customAreaOfExpertise);

    if (!formValues.fullName || formValues.fullName.trim() === "") {
      newErrors.fullName = "Please enter your full name.";
    }

    if (!email) {
      newErrors.email = "Please enter your email address.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!formValues.pincode || formValues.pincode.trim() === "") {
      newErrors.pincode = "Please enter your pincode.";
    } else if (!/^\d{6}$/.test(formValues.pincode.trim())) {
      newErrors.pincode = "Please enter a valid 6-digit pincode.";
    }

    if (!formValues.membershipNumber || formValues.membershipNumber.trim() === "") {
      newErrors.membershipNumber = "Please enter your membership number.";
    }

    if (!["Active", "Inactive", "Not Applicable"].includes(formValues.cop.trim())) {
      newErrors.cop = "Please select your COP status.";
    }

    if (!qualification) {
      newErrors.qualification = "Please select your qualification.";
    }

    if (!areaOfExpertise) {
      newErrors.areaOfExpertise = "Please select your area of expertise.";
    }

    if (!file) {
      newErrors.profile = "Please upload your profile document.";
    }

    if (!captchaToken) {
      newErrors.captcha = "Please complete the security verification.";
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
      setShowErrorBanner(false);
      setErrorMessage("");
      scrollToFirstInvalidField(validationErrors);
      return;
    }

    setErrors({});
    setShowErrorBanner(false);
    setLoading(true);

    try {
      const normalizedValues = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()])
      ) as ExpertFormData;
      const resolvedQualification = resolveSelectedValue(
        normalizedValues.qualification,
        normalizedValues.customQualification
      );
      const resolvedAreaOfExpertise = resolveSelectedValue(
        normalizedValues.areaOfExpertise,
        normalizedValues.customAreaOfExpertise
      );

      if (!normalizedValues.fullName) throw new Error("Please enter your full name.");
      if (!normalizedValues.email) throw new Error("Please enter your email address.");
      if (!normalizedValues.pincode) throw new Error("Please enter your pincode.");
      if (!normalizedValues.membershipNumber) throw new Error("Please enter your membership number.");
      if (!profileFile) throw new Error("Please upload your profile document.");
      if (!resolvedQualification) throw new Error("Please select your qualification.");
      if (!captchaToken) throw new Error("Please complete the security verification.");
      if (!normalizedValues.cop) throw new Error("Please select your COP status.");
      if (!resolvedAreaOfExpertise) throw new Error("Please select your area of expertise.");

      const formData = new FormData();
      formData.append("fullName", normalizedValues.fullName || "");
      formData.append("email", normalizedValues.email || "");
      formData.append("pincode", normalizedValues.pincode || "");
      formData.append("membershipNumber", normalizedValues.membershipNumber || "");
      formData.append("cop", normalizedValues.cop || "");
      formData.append("qualification", resolvedQualification || "");
      formData.append("areaOfExpertise", resolvedAreaOfExpertise || "");
      formData.append("profile", profileFile);
      formData.append("g-recaptcha-response", captchaToken);

      console.log("Submitting to:", SUBMIT_URL);
      for (const pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }

      debugLog("Submitting expert onboarding form.", {
        url: SUBMIT_URL,
        requiredFields: REQUIRED_FIELDS,
        hasProfile: true,
        hasRecaptchaToken: Boolean(captchaToken),
        formKeys: Array.from(formData.keys()),
      });

      const abortController = new AbortController();
      const timeoutId = window.setTimeout(() => abortController.abort(), SUBMISSION_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(SUBMIT_URL, {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      const text = await response.text();
      console.log("Raw submit response:", text);

      let data: ExpertOnboardingResponse;
      try {
        data = JSON.parse(text) as ExpertOnboardingResponse;
      } catch {
        throw new Error("Invalid server response");
      }

      console.log("Parsed submit response:", data);

      debugLog("Expert onboarding response received.", {
        status: response.status,
        ok: response.ok,
        body: data,
      });

      if (!response.ok || !data?.success) {
        if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
          setErrors(data.fieldErrors);
          setShowErrorBanner(false);
          setErrorMessage("");
          scrollToFirstInvalidField(data.fieldErrors);
          return;
        }
        throw new Error(data?.message || FALLBACK_SUBMISSION_ERROR);
      }

      setSuccessMessage(data.message || "Application submitted successfully.");
      setSubmittedName(normalizedValues.fullName);
      setValues(initialValues);
      setProfileFile(null);
      setCaptchaToken("");
      setErrors({});
      setShowErrorBanner(false);
      setErrorMessage("");
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
      recaptchaRef.current?.reset();
    } catch (error) {
      debugLog("Expert onboarding submission failed.", error);
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setErrorMessage(message);
      setShowErrorBanner(Boolean(message));
      setCaptchaToken("");
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={IS_IOS_NATIVE_APP ? "nritax-ios-join-page font-sans text-[#0F172A]" : "py-10 font-sans text-[#0F172A]"}>
      {IS_IOS_NATIVE_APP ? (
        <style>
          {`
            .nritax-ios-join-page {
              width: 100%;
              max-width: 100vw;
              overflow-x: hidden;
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
            .nritax-ios-join-page input,
            .nritax-ios-join-page select {
              width: 100% !important;
              height: 44px !important;
              font-size: 16px !important;
            }
            .nritax-ios-join-page .grid,
            .nritax-ios-join-page form,
            .nritax-ios-join-page [data-slot="card"],
            .nritax-ios-join-page [data-slot="card-content"] {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
            }
            .nritax-ios-join-page iframe {
              max-width: calc(100vw - 56px) !important;
              transform-origin: left top;
            }
          `}
        </style>
      ) : null}
      <div className={IS_IOS_NATIVE_APP ? "mx-auto w-full max-w-full px-3" : "mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563eb] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className={IS_IOS_NATIVE_APP ? "mb-5 w-full max-w-full" : "mb-10 max-w-3xl"}>
          <p className={IS_IOS_NATIVE_APP ? "text-xs font-semibold uppercase tracking-[0.14em] text-[#2563eb]" : "text-sm font-semibold uppercase tracking-[0.18em] text-[#2563eb]"}>Expert Onboarding</p>
          <h1 className={IS_IOS_NATIVE_APP ? "mt-2 text-2xl text-[#0F172A]" : "mt-2 text-3xl text-[#0F172A] sm:text-4xl"}>Join Our Expert Team</h1>
          <p className={IS_IOS_NATIVE_APP ? "mt-2 text-sm leading-6 text-[#0F172A]" : "mt-3 text-base leading-7 text-[#0F172A]"}>
            Join NRITAX as a Chartered Accountant or expert and help NRI users with tax and compliance services.
          </p>
        </div>

        <Card className={IS_IOS_NATIVE_APP ? "w-full max-w-full overflow-hidden border border-[#E2E8F0] bg-[#F7FAFC] font-sans shadow-none" : "border border-[#E2E8F0] bg-[#F7FAFC] font-sans shadow-xl"}>
          <CardHeader className={IS_IOS_NATIVE_APP ? "px-4 py-5" : undefined}>
            <CardTitle className={IS_IOS_NATIVE_APP ? "text-xl text-[#0F172A]" : "text-2xl text-[#0F172A]"}>Expert Registration Form</CardTitle>
            <CardDescription className="text-[#0F172A]">
              Share your profile so our team can evaluate your fit for NRITAX expert onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className={IS_IOS_NATIVE_APP ? "px-4 pb-5" : undefined}>
            {successMessage ? (
              <div className="mb-6 rounded-[12px] border border-[#A7F3D0] bg-[#ECFDF5] p-6 text-emerald-900">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#065F46]" />
                  <div>
                    <p className="text-lg font-semibold text-[#065F46]">Application Submitted Successfully</p>
                    <p className="mt-3 text-sm leading-6 text-[#065F46]">Hi {submittedName || "there"},</p>
                    <p className="mt-3 text-sm leading-6 text-emerald-900">
                      Thank you for showing interest in joining the NRITAX expert team.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-emerald-900">
                      Our onboarding team will review your application and contact you soon regarding the next steps.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-emerald-900">
                      We appreciate your interest in working with NRITAX.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {showErrorBanner && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage || FALLBACK_SUBMISSION_ERROR}
                  </div>
                )}

                <form onSubmit={handleSubmit} className={IS_IOS_NATIVE_APP ? "w-full max-w-full space-y-5" : "space-y-6"} noValidate>
              <div className={IS_IOS_NATIVE_APP ? "grid w-full max-w-full grid-cols-1 gap-4" : "grid gap-5 md:grid-cols-2"}>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-[#0F172A]">Full Name {requiredAsterisk}</Label>
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
                  />
                  {errors.fullName ? <p id={getFieldErrorId("fullName")} className={errorMessageClassName}>{errors.fullName}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[#0F172A]">Email {requiredAsterisk}</Label>
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
                  />
                  {errors.email ? <p id={getFieldErrorId("email")} className={errorMessageClassName}>{errors.email}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode" className="text-sm font-medium text-[#0F172A]">Pincode {requiredAsterisk}</Label>
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
                  />
                  {errors.pincode ? <p id={getFieldErrorId("pincode")} className={errorMessageClassName}>{errors.pincode}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="membershipNumber" className="text-sm font-medium text-[#0F172A]">Membership Number {requiredAsterisk}</Label>
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
                  />
                  {errors.membershipNumber ? (
                    <p id={getFieldErrorId("membershipNumber")} className={errorMessageClassName}>{errors.membershipNumber}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cop" className="text-sm font-medium text-[#0F172A]">COP {requiredAsterisk}</Label>
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
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#6B7280]" />
                  </div>
                  {errors.cop ? <p id={getFieldErrorId("cop")} className={errorMessageClassName}>{errors.cop}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualification" className="text-sm font-medium text-[#0F172A]">Qualification {requiredAsterisk}</Label>
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
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#6B7280]" />
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
                  <Label htmlFor="areaOfExpertise" className="text-sm font-medium text-[#0F172A]">Area of Expertise {requiredAsterisk}</Label>
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
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#6B7280]" />
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

                <div className="space-y-2">
                  <Label htmlFor="profile" className="text-sm font-medium text-[#0F172A]">Profile {requiredAsterisk}</Label>
                  <div
                    ref={setFieldRef("profile") as never}
                    className={`rounded-xl border border-dashed bg-white/70 p-4 transition hover:bg-[#F9FAFB] ${errors.profile ? "border-[#DC2626]" : "border-[#CBD5E1]"}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Upload profile from desktop</p>
                        <p className="text-xs text-[#0F172A]/70">Accepted formats: PDF, DOC, DOCX up to 10 MB</p>
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
                      aria-describedby={errors.profile ? getFieldErrorId("profile") : undefined}
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
                    {errors.profile ? <p id={getFieldErrorId("profile")} className={errorMessageClassName}>{errors.profile}</p> : null}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] pt-5">
                <div className="mb-4">
                  <div
                    ref={setFieldRef("captcha") as never}
                    className={`mt-3 rounded-xl border bg-white px-4 py-4 ${errors.captcha ? "border-[#DC2626]" : "border-[#CBD5E1]"}`}
                  >
                    <div>
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Security Verification</p>
                        <p className="mt-1 text-xs text-[#0F172A]/70">Please complete the checkbox below to continue.</p>
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <div
                        className="min-h-[78px]"
                        aria-invalid={errors.captcha ? true : undefined}
                        aria-describedby={errors.captcha ? getFieldErrorId("captcha") : undefined}
                      >
                        <ReCAPTCHA
                          ref={recaptchaRef}
                          sitekey={RECAPTCHA_SITE_KEY}
                          onChange={(token) => {
                            setCaptchaToken(token || "");
                            setErrors((prev) => ({
                              ...prev,
                              captcha: "",
                            }));
                            setShowErrorBanner(false);
                          }}
                          onExpired={() => setCaptchaToken("")}
                          onErrored={() => setCaptchaToken("")}
                        />
                      </div>
                    </div>
                  </div>
                  {errors.captcha ? <p id={getFieldErrorId("captcha")} className={errorMessageClassName}>{errors.captcha}</p> : null}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="submit" className="h-11 px-6" disabled={loading}>
                    {loading ? "Submitting..." : "Submit Application"}
                  </Button>
                  <p className="text-sm leading-6 text-[#0F172A]">
                    Your details will be reviewed by our team before onboarding.
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#0F172A]/80">
                  Your information is secure and used only for onboarding purposes.
                </p>
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
