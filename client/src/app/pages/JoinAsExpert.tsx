import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Paperclip, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { COUNTRY_OPTIONS, detectUserCountry } from "../utils/countries";
import { EXPERT_ONBOARDING_WEBHOOK, isValidEmail, trimValue } from "../utils/consultationWorkflow";

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
  resumeLink: string;
};

type FieldKey =
  | "fullName"
  | "mobileNumber"
  | "email"
  | "profession"
  | "areaOfExpertise";

const INITIAL_FORM_DATA: ExpertFormData = {
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
  resumeLink: "",
};

const toTitleCase = (value: string) =>
  trimValue(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isValidMobileNumber = (value: string) => {
  const digits = trimValue(value).replace(/\D/g, "");
  return digits.length === 10;
};

export function JoinAsExpert() {
  const navigate = useNavigate();
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<ExpertFormData>(INITIAL_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadedResume, setUploadedResume] = useState<{ name: string; dataUrl: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawUser = localStorage.getItem("user");
      if (!rawUser) {
        setFormData((prev) => ({
          ...prev,
          country: prev.country || detectUserCountry(),
        }));
        return;
      }

      const parsedUser = JSON.parse(rawUser);
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || trimValue(parsedUser?.name),
        email: prev.email || trimValue(parsedUser?.email),
        country: prev.country || trimValue(parsedUser?.countryOfResidence) || detectUserCountry(),
      }));
    } catch {
      setFormData((prev) => ({
        ...prev,
        country: prev.country || detectUserCountry(),
      }));
    }
  }, []);

  const setFieldValue = (key: keyof ExpertFormData, value: string) => {
    let nextValue = value;

    if (key === "mobileNumber") {
      nextValue = value.replace(/\D/g, "").slice(0, 10);
    }
    if (key === "profession" || key === "areaOfExpertise") {
      nextValue = value.toUpperCase();
    }
    if (key === "city" || key === "state") {
      nextValue = toTitleCase(value);
    }

    setFormData((prev) => ({ ...prev, [key]: nextValue }));
    if (key in fieldErrors) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key as FieldKey];
        return next;
      });
    }
    if (successMessage) setSuccessMessage("");
    if (errorMessage) setErrorMessage("");
  };

  const handleResumeFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isAllowedType =
      [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(file.type) || /\.(pdf|doc|docx)$/i.test(file.name);

    if (!isAllowedType) {
      setUploadedResume(null);
      setErrorMessage("Please upload resume files in PDF, DOC, or DOCX format.");
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Unable to read the selected resume file."));
        reader.readAsDataURL(file);
      });

      setUploadedResume({ name: file.name, dataUrl });
      setFieldValue("resumeLink", "");
    } catch (error: any) {
      setUploadedResume(null);
      setErrorMessage(error?.message || "Unable to read the selected resume file.");
    } finally {
      event.target.value = "";
    }
  };

  const clearUploadedResume = () => {
    setUploadedResume(null);
    if (resumeInputRef.current) {
      resumeInputRef.current.value = "";
    }
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<FieldKey, string>> = {};

    if (!trimValue(formData.fullName)) nextErrors.fullName = "Full name is required.";
    if (!isValidMobileNumber(formData.mobileNumber)) {
      nextErrors.mobileNumber = "Enter a valid 10-digit mobile number";
    }
    if (!isValidEmail(formData.email)) nextErrors.email = "Enter a valid email address.";
    if (!trimValue(formData.profession)) nextErrors.profession = "Profession is required.";
    if (!trimValue(formData.areaOfExpertise)) {
      nextErrors.areaOfExpertise = "Area of expertise is required.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setSuccessMessage("");
    setErrorMessage("");
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload: ExpertFormData = {
        fullName: trimValue(formData.fullName),
        mobileNumber: trimValue(formData.mobileNumber),
        email: trimValue(formData.email),
        profession: trimValue(formData.profession),
        areaOfExpertise: trimValue(formData.areaOfExpertise),
        yearsOfExperience: trimValue(formData.yearsOfExperience),
        qualification: trimValue(formData.qualification),
        firmName: trimValue(formData.firmName),
        country: trimValue(formData.country),
        state: trimValue(formData.state),
        city: trimValue(formData.city),
        servicesOffered: trimValue(formData.servicesOffered),
        linkedinOrWebsite: trimValue(formData.linkedinOrWebsite),
        shortBio: trimValue(formData.shortBio),
        resumeLink: uploadedResume?.dataUrl || trimValue(formData.resumeLink),
      };

      const response = await fetch(EXPERT_ONBOARDING_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(result?.message || "Unable to submit expert registration right now.");
      }

      setSuccessMessage("Application Submitted");
      setErrorMessage("");
      setFieldErrors({});
      setFormData({
        ...INITIAL_FORM_DATA,
        country: detectUserCountry(),
      });
      setUploadedResume(null);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to submit expert registration right now.");
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
            {errorMessage ? (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFieldValue("fullName", e.target.value)}
                    aria-invalid={fieldErrors.fullName ? true : undefined}
                    placeholder="Enter your full name"
                  />
                  {fieldErrors.fullName ? <p className="text-sm text-red-600">{fieldErrors.fullName}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobileNumber">Mobile Number *</Label>
                  <Input
                    id="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={(e) => setFieldValue("mobileNumber", e.target.value)}
                    aria-invalid={fieldErrors.mobileNumber ? true : undefined}
                    placeholder="Enter your mobile number"
                  />
                  {fieldErrors.mobileNumber ? <p className="text-sm text-red-600">{fieldErrors.mobileNumber}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFieldValue("email", e.target.value)}
                    aria-invalid={fieldErrors.email ? true : undefined}
                    placeholder="Enter your email address"
                  />
                  {fieldErrors.email ? <p className="text-sm text-red-600">{fieldErrors.email}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profession">Profession *</Label>
                  <Input
                    id="profession"
                    value={formData.profession}
                    onChange={(e) => setFieldValue("profession", e.target.value)}
                    aria-invalid={fieldErrors.profession ? true : undefined}
                    placeholder="CA, CPA, Tax Advisor, Lawyer..."
                  />
                  {fieldErrors.profession ? <p className="text-sm text-red-600">{fieldErrors.profession}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="areaOfExpertise">Area of Expertise *</Label>
                  <Input
                    id="areaOfExpertise"
                    value={formData.areaOfExpertise}
                    onChange={(e) => setFieldValue("areaOfExpertise", e.target.value)}
                    aria-invalid={fieldErrors.areaOfExpertise ? true : undefined}
                    placeholder="DTAA, FEMA, NRI filing, property tax, capital gains..."
                  />
                  {fieldErrors.areaOfExpertise ? (
                    <p className="text-sm text-red-600">{fieldErrors.areaOfExpertise}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                  <Input
                    id="yearsOfExperience"
                    value={formData.yearsOfExperience}
                    onChange={(e) => setFieldValue("yearsOfExperience", e.target.value)}
                    placeholder="e.g. 8 years"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    value={formData.qualification}
                    onChange={(e) => setFieldValue("qualification", e.target.value)}
                    placeholder="CA, CPA, ACCA, LLM..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firmName">Firm Name</Label>
                  <Input
                    id="firmName"
                    value={formData.firmName}
                    onChange={(e) => setFieldValue("firmName", e.target.value)}
                    placeholder="Enter your firm name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    list="expert-country-options"
                    value={formData.country}
                    onChange={(e) => setFieldValue("country", e.target.value)}
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
                    value={formData.state}
                    onChange={(e) => setFieldValue("state", e.target.value)}
                    placeholder="Enter your state"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFieldValue("city", e.target.value)}
                    placeholder="Enter your city"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="servicesOffered">Services Offered</Label>
                  <Textarea
                    id="servicesOffered"
                    value={formData.servicesOffered}
                    onChange={(e) => setFieldValue("servicesOffered", e.target.value)}
                    className="min-h-32"
                    placeholder="Describe the services you can provide to NRI users"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedinOrWebsite">LinkedIn / Website</Label>
                  <Input
                    id="linkedinOrWebsite"
                    value={formData.linkedinOrWebsite}
                    onChange={(e) => setFieldValue("linkedinOrWebsite", e.target.value)}
                    placeholder="LinkedIn or website URL"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resumeLink">Resume Link</Label>
                  <Input
                    id="resumeLink"
                    value={formData.resumeLink}
                    onChange={(e) => setFieldValue("resumeLink", e.target.value)}
                    disabled={Boolean(uploadedResume)}
                    placeholder="Link to resume or portfolio"
                  />
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
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={handleResumeFileChange}
                    />
                    {uploadedResume ? (
                      <div className="mt-3 flex items-center justify-between rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#1D4ED8]">
                        <span className="truncate pr-3">{uploadedResume.name}</span>
                        <button
                          type="button"
                          onClick={clearUploadedResume}
                          className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                        >
                          <X className="size-3.5" />
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="shortBio">Short Bio</Label>
                  <Textarea
                    id="shortBio"
                    value={formData.shortBio}
                    onChange={(e) => setFieldValue("shortBio", e.target.value)}
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

export default JoinAsExpert;
