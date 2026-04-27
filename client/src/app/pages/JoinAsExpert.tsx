import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./JoinAsExpert.css";

type ExpertFormValues = {
  fullName: string;
  email: string;
  pincode: string;
  membershipNumber: string;
  cop: string;
  qualification: string;
  areaOfExpertise: string;
};

type FieldName = keyof ExpertFormValues;
type FormErrors = Partial<Record<FieldName | "profile" | "captcha", string>>;

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
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
  }
}

const SUBMIT_URL = "https://n8n.caloganathan.com/webhook/expert-onboarding";
const RECAPTCHA_SITE_KEY = "6LfbPaEsAAAAAIRxHR8s1bZojFeuJoQ0Vgq2wSdo";
const SUBMISSION_TIMEOUT_MS = 15000;
const PDF_MIME_TYPE = "application/pdf";

const initialValues: ExpertFormValues = {
  fullName: "",
  email: "",
  pincode: "",
  membershipNumber: "",
  cop: "",
  qualification: "",
  areaOfExpertise: "",
};

const isPdfFile = (file: File | null) => {
  if (!file) return false;
  const normalizedName = file.name.toLowerCase();
  return file.type === PDF_MIME_TYPE || normalizedName.endsWith(".pdf");
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function JoinAsExpertPage() {
  const navigate = useNavigate();
  const recaptchaRef = useRef<HTMLDivElement | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<ExpertFormValues>(initialValues);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const intervalId = window.setInterval(() => {
      if (!window.grecaptcha || !recaptchaRef.current || recaptchaWidgetIdRef.current !== null) {
        return;
      }

      recaptchaWidgetIdRef.current = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token: string) => {
          setCaptchaToken(token);
          setErrors((prev) => ({ ...prev, captcha: "" }));
        },
        "expired-callback": () => {
          setCaptchaToken(null);
        },
        "error-callback": () => {
          setCaptchaToken(null);
        },
      });

      window.clearInterval(intervalId);
    }, 250);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setValues((prev) => ({
      ...prev,
      [name]: name === "pincode" ? value.replace(/\D/g, "").slice(0, 6) : value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
    setErrorMessage("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    setProfileFile(file);
    setErrors((prev) => ({
      ...prev,
      profile: file && !isPdfFile(file) ? "Please upload a PDF file." : "",
    }));
    setErrorMessage("");
  };

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};

    (Object.keys(initialValues) as FieldName[]).forEach((fieldName) => {
      if (!values[fieldName].trim()) {
        nextErrors[fieldName] = "This field is required.";
      }
    });

    if (values.email.trim() && !isValidEmail(values.email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!profileFile) {
      nextErrors.profile = "Please upload your profile PDF.";
    } else if (!isPdfFile(profileFile)) {
      nextErrors.profile = "Please upload a PDF file.";
    }

    const widgetId = recaptchaWidgetIdRef.current ?? undefined;
    const token = window.grecaptcha?.getResponse(widgetId) || "";

    if (!token.trim()) {
      nextErrors.captcha = "Please complete the CAPTCHA.";
    }

    return nextErrors;
  };

  const resetForm = () => {
    setValues(initialValues);
    setProfileFile(null);
    setCaptchaToken(null);
    setErrors({});
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (window.grecaptcha && recaptchaWidgetIdRef.current !== null) {
      window.grecaptcha.reset(recaptchaWidgetIdRef.current);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setSuccessMessage("");
    setErrorMessage("");

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      if (validationErrors.captcha) {
        alert("Please complete CAPTCHA");
      }
      setErrorMessage("Please fix the highlighted fields and try again.");
      return;
    }

    const widgetId = recaptchaWidgetIdRef.current ?? undefined;
    const token = window.grecaptcha?.getResponse(widgetId) || "";

    if (!token.trim()) {
      setErrors((prev) => ({ ...prev, captcha: "Please complete the CAPTCHA." }));
      setErrorMessage("Please complete the CAPTCHA.");
      alert("Please complete CAPTCHA");
      return;
    }

    if (!profileFile) {
      setErrors((prev) => ({ ...prev, profile: "Please upload your profile PDF." }));
      setErrorMessage("Please upload your profile PDF.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("fullName", values.fullName.trim());
      formData.append("email", values.email.trim());
      formData.append("pincode", values.pincode.trim());
      formData.append("membershipNumber", values.membershipNumber.trim());
      formData.append("cop", values.cop.trim());
      formData.append("qualification", values.qualification.trim());
      formData.append("areaOfExpertise", values.areaOfExpertise.trim());
      formData.append("profile", profileFile);
      formData.append("g-recaptcha-response", token);

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

      const rawResponse = await response.text();

      let data: ExpertOnboardingResponse | null = null;
      if (rawResponse.trim()) {
        try {
          data = JSON.parse(rawResponse) as ExpertOnboardingResponse;
        } catch {
          throw new Error("Invalid server response.");
        }
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Submission failed. Please try again.");
      }

      setSuccessMessage(data.message || "Application submitted successfully.");
      resetForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong while submitting the form.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="expert-onboarding-page">
      <div className="expert-onboarding-shell">
        <button type="button" className="expert-back-link" onClick={() => navigate(-1)}>
          Back
        </button>

        <section className="expert-onboarding-card">
          <div className="expert-onboarding-header">
            <p className="expert-onboarding-eyebrow">Expert Onboarding</p>
            <h1>Join Our Expert Team</h1>
            <p>
              Submit your professional details and PDF profile so our team can review your onboarding
              request.
            </p>
          </div>

          {successMessage ? (
            <div className="expert-alert expert-alert-success" role="status">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="expert-alert expert-alert-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <form className="expert-form" onSubmit={handleSubmit} noValidate>
            <div className="expert-form-grid">
              <label className="expert-field">
                <span>Full Name</span>
                <input
                  type="text"
                  name="fullName"
                  value={values.fullName}
                  onChange={handleFieldChange}
                  disabled={loading}
                  aria-invalid={errors.fullName ? "true" : "false"}
                />
                {errors.fullName ? <small>{errors.fullName}</small> : null}
              </label>

              <label className="expert-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={values.email}
                  onChange={handleFieldChange}
                  disabled={loading}
                  aria-invalid={errors.email ? "true" : "false"}
                />
                {errors.email ? <small>{errors.email}</small> : null}
              </label>

              <label className="expert-field">
                <span>Pincode</span>
                <input
                  type="text"
                  name="pincode"
                  value={values.pincode}
                  onChange={handleFieldChange}
                  disabled={loading}
                  aria-invalid={errors.pincode ? "true" : "false"}
                />
                {errors.pincode ? <small>{errors.pincode}</small> : null}
              </label>

              <label className="expert-field">
                <span>Membership Number</span>
                <input
                  type="text"
                  name="membershipNumber"
                  value={values.membershipNumber}
                  onChange={handleFieldChange}
                  disabled={loading}
                  aria-invalid={errors.membershipNumber ? "true" : "false"}
                />
                {errors.membershipNumber ? <small>{errors.membershipNumber}</small> : null}
              </label>

              <label className="expert-field">
                <span>COP</span>
                <input
                  type="text"
                  name="cop"
                  value={values.cop}
                  onChange={handleFieldChange}
                  disabled={loading}
                  aria-invalid={errors.cop ? "true" : "false"}
                />
                {errors.cop ? <small>{errors.cop}</small> : null}
              </label>

              <label className="expert-field">
                <span>Qualification</span>
                <input
                  type="text"
                  name="qualification"
                  value={values.qualification}
                  onChange={handleFieldChange}
                  disabled={loading}
                  aria-invalid={errors.qualification ? "true" : "false"}
                />
                {errors.qualification ? <small>{errors.qualification}</small> : null}
              </label>

              <label className="expert-field expert-field-full">
                <span>Area of Expertise</span>
                <input
                  type="text"
                  name="areaOfExpertise"
                  value={values.areaOfExpertise}
                  onChange={handleFieldChange}
                  disabled={loading}
                  aria-invalid={errors.areaOfExpertise ? "true" : "false"}
                />
                {errors.areaOfExpertise ? <small>{errors.areaOfExpertise}</small> : null}
              </label>

              <label className="expert-field expert-field-full">
                <span>Profile (PDF only)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  name="profile"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  disabled={loading}
                  aria-invalid={errors.profile ? "true" : "false"}
                />
                <p className="expert-file-hint">
                  {profileFile ? `Selected file: ${profileFile.name}` : "Upload a PDF version of your profile."}
                </p>
                {errors.profile ? <small>{errors.profile}</small> : null}
              </label>
            </div>

            <div className="expert-captcha-wrap">
              <div ref={recaptchaRef} />
              {errors.captcha ? <small>{errors.captcha}</small> : null}
            </div>

            <button type="submit" className="expert-submit-button" disabled={loading}>
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default JoinAsExpertPage;
