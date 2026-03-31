import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Paperclip, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { COUNTRY_OPTIONS, detectUserCountry } from "../utils/countries";
import { EXPERT_ONBOARDING_WEBHOOK, trimValue } from "../utils/consultationWorkflow";

type ExpertFormData = {
  fullName: string;
  mobileNumber: string;
  email: string;
  profession: string;
  areaOfExpertise: string;
  yearsOfExperience: string;
  qualification: string;
  firmName: string;
  country: string;
  state: string;
  city: string;
  servicesOffered: string;
  linkedinOrWebsite: string;
  shortBio: string;
};

type FieldKey = keyof ExpertFormData;
type ExpertFormFieldKey = FieldKey | "resume";

const initialValues: ExpertFormData = {
  fullName: "",
  mobileNumber: "",
  email: "",
  profession: "",
  areaOfExpertise: "",
  yearsOfExperience: "",
  qualification: "",
  firmName: "",
  country: "",
  state: "",
  city: "",
  servicesOffered: "",
  linkedinOrWebsite: "",
  shortBio: "",
};

type ExpertOnboardingResponse = {
  success?: boolean;
  message?: string;
  resumeLink?: string;
};

const SUBMISSION_TIMEOUT_MS = 15000;
const FALLBACK_SUBMISSION_ERROR = "Submission failed. Please try again.";
const REQUIRED_FIELDS: FieldKey[] = ["fullName", "mobileNumber", "email", "profession", "areaOfExpertise"];

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
      if (!rawUser) {
        setValues((prev) => ({
          ...prev,
          country: prev.country || detectUserCountry(),
        }));
        return;
      }

      const parsedUser = JSON.parse(rawUser);
      setValues((prev) => ({
        ...prev,
        fullName: prev.fullName || trimValue(parsedUser?.name),
        email: prev.email || trimValue(parsedUser?.email),
        country: prev.country || trimValue(parsedUser?.countryOfResidence) || detectUserCountry(),
      }));
    } catch {
      setValues((prev) => ({
        ...prev,
        country: prev.country || detectUserCountry(),
      }));
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === "mobileNumber") {
      nextValue = value.replace(/\D/g, "").slice(0, 10);
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

    if (!values.profession || values.profession.trim() === "") {
      newErrors.profession = "Profession is required";
    }

    if (!values.areaOfExpertise || values.areaOfExpertise.trim() === "") {
      newErrors.areaOfExpertise = "Area of expertise is required";
    }

    if (
      values.linkedinOrWebsite &&
      values.linkedinOrWebsite.trim() !== "" &&
      !/^https?:\/\/.+/.test(values.linkedinOrWebsite.trim())
    ) {
      newErrors.linkedinOrWebsite = "Enter a valid URL";
    }

    if (!file) {
      newErrors.resume = "Please upload your resume.";
    }

    return newErrors;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setShowErrorBanner(false);
    setSuccessMessage("");
    setErrorMessage("");

    if (loading) return;

    const validationErrors = validateForm(values, resumeFile);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setErrorMessage(validationErrors.resume ? validationErrors.resume : "Please fill all required fields.");
      setShowErrorBanner(true);
      return;
    }

    setErrors({});
    setShowErrorBanner(false);
    setLoading(true);

    try {
      const formData = new FormData();
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
        if (!value) continue;
        formData.append(key, value);
      }

      formData.append("resume", resumeFile as File);

      debugLog("Submitting expert onboarding form.", {
        url: EXPERT_ONBOARDING_WEBHOOK,
        requiredFields: REQUIRED_FIELDS,
        hasResume: true,
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
      } else {
        setErrorMessage(getSubmissionErrorMessage(response, data));
        setShowErrorBanner(true);
      }
    } catch (error) {
      debugLog("Expert onboarding submission failed.", error);
      if (error instanceof DOMException && error.name === "AbortError") {
        setErrorMessage(FALLBACK_SUBMISSION_ERROR);
      } else {
        setErrorMessage("Unable to reach the server. Please try again.");
      }
      setShowErrorBanner(true);
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

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
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
                    value={values.email}
                    onChange={handleChange}
                    aria-invalid={errors.email ? true : undefined}
                    placeholder="Enter your email address"
                  />
                  {errors.email ? <p className="text-sm text-red-600">{errors.email}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profession">Profession *</Label>
                  <Input
                    id="profession"
                    name="profession"
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
                  <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                  <Input
                    id="yearsOfExperience"
                    name="yearsOfExperience"
                    value={values.yearsOfExperience}
                    onChange={handleChange}
                    placeholder="e.g. 8 years"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    name="qualification"
                    value={values.qualification}
                    onChange={handleChange}
                    placeholder="CA, CPA, ACCA, LLM..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firmName">Firm Name</Label>
                  <Input
                    id="firmName"
                    name="firmName"
                    value={values.firmName}
                    onChange={handleChange}
                    placeholder="Enter your firm name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    list="expert-country-options"
                    value={values.country}
                    onChange={handleChange}
                    placeholder="Select or type your country"
                  />
                  <datalist id="expert-country-options">
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country.code} value={country.name} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    value={values.state}
                    onChange={handleChange}
                    placeholder="Enter your state"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    value={values.city}
                    onChange={handleChange}
                    placeholder="Enter your city"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="servicesOffered">Services Offered</Label>
                  <Textarea
                    id="servicesOffered"
                    name="servicesOffered"
                    value={values.servicesOffered}
                    onChange={handleChange}
                    className="min-h-32"
                    placeholder="Describe the services you can provide to NRI users"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedinOrWebsite">LinkedIn / Website</Label>
                  <Input
                    id="linkedinOrWebsite"
                    name="linkedinOrWebsite"
                    value={values.linkedinOrWebsite}
                    onChange={handleChange}
                    aria-invalid={errors.linkedinOrWebsite ? true : undefined}
                    placeholder="LinkedIn or website URL"
                  />
                  {errors.linkedinOrWebsite ? (
                    <p className="text-sm text-red-600">{errors.linkedinOrWebsite}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resume">Resume</Label>
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

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="shortBio">Short Bio</Label>
                  <Textarea
                    id="shortBio"
                    name="shortBio"
                    value={values.shortBio}
                    onChange={handleChange}
                    className="min-h-28"
                    placeholder="Briefly introduce your background and expertise"
                  />
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] pt-5">
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
