import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Linkedin,
  LockKeyhole,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";

type SignupFormProps = {
  signupData: {
    name: string;
    email: string;
    linkedinProfile: string;
    password: string;
    confirmPassword: string;
    termsAccepted: boolean;
  };
  loading: boolean;
  error: string | null;
  canContinue: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onFieldChange: (field: "name" | "email" | "linkedinProfile" | "password" | "confirmPassword", value: string) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
  onTermsChange: (checked: boolean) => void;
  onOpenTerms: (type: "terms" | "privacy") => void;
  countryField: ReactNode;
  socialButtons: ReactNode;
};

type FieldProps = {
  label: string;
  icon: typeof User | typeof Mail | typeof Linkedin | typeof KeyRound | typeof LockKeyhole;
  endAdornment?: ReactNode;
} & ComponentProps<typeof Input>;

const getPasswordStrength = (password: string) => {
  if (!password) return { value: 0, label: "Add a secure password" };
  if (password.length < 6) return { value: 33, label: "Too short" };
  if (password.length < 10) return { value: 66, label: "Acceptable" };
  return { value: 100, label: "Strong" };
};

function Field({ label, icon: Icon, endAdornment, className, ...props }: FieldProps) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-medium text-slate-800">{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className={`h-13 rounded-xl border-slate-300 bg-white pl-11 pr-12 text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:border-[#1d4ed8] focus-visible:ring-[#1d4ed8]/10 ${className || ""}`}
          {...props}
        />
        {endAdornment ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {endAdornment}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SignupForm({
  signupData,
  loading,
  error,
  canContinue,
  showPassword,
  showConfirmPassword,
  onSubmit,
  onFieldChange,
  onTogglePassword,
  onToggleConfirmPassword,
  onTermsChange,
  onOpenTerms,
  countryField,
  socialButtons,
}: SignupFormProps) {
  const passwordStrength = getPasswordStrength(signupData.password);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5">
        <Field
          label="Full Name"
          icon={User}
          required
          autoComplete="name"
          placeholder="Your full name"
          value={signupData.name}
          onChange={(event) => onFieldChange("name", event.target.value)}
        />

        <Field
          label="Email Address"
          icon={Mail}
          type="email"
          required
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="email"
          placeholder="your.email@example.com"
          value={signupData.email}
          onChange={(event) => onFieldChange("email", event.target.value)}
        />

        <Field
          label="LinkedIn Profile (optional)"
          icon={Linkedin}
          type="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://www.linkedin.com/in/your-profile"
          value={signupData.linkedinProfile}
          onChange={(event) => onFieldChange("linkedinProfile", event.target.value)}
        />

        {countryField}

        <div>
          <Field
            label="Password"
            icon={KeyRound}
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="Create a password"
            value={signupData.password}
            onChange={(event) => onFieldChange("password", event.target.value)}
            endAdornment={
              <button
                type="button"
                onClick={onTogglePassword}
                className="inline-flex size-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
          <div className="space-y-2 pt-2">
            <Progress value={passwordStrength.value} className="h-1.5 bg-slate-100" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Use at least 6 characters for a secure password.</span>
              <span className="font-medium text-slate-700">{passwordStrength.label}</span>
            </div>
          </div>
        </div>

        <Field
          label="Confirm Password"
          icon={LockKeyhole}
          type={showConfirmPassword ? "text" : "password"}
          required
          autoComplete="new-password"
          placeholder="Confirm your password"
          value={signupData.confirmPassword}
          onChange={(event) => onFieldChange("confirmPassword", event.target.value)}
          endAdornment={
            <button
              type="button"
              onClick={onToggleConfirmPassword}
              className="inline-flex size-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
      </div>

      <AnimatePresence initial={false}>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="leading-6">{error}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={signupData.termsAccepted}
            onChange={(event) => onTermsChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1d4ed8] focus:ring-[#1d4ed8]"
          />
          <span className="text-sm leading-6 text-slate-700">
            I agree to the{" "}
            <button
              type="button"
              onClick={() => onOpenTerms("terms")}
              className="font-medium text-[#1d4ed8] underline underline-offset-4"
            >
              Terms & Conditions
            </button>{" "}
            and{" "}
            <button
              type="button"
              onClick={() => onOpenTerms("privacy")}
              className="font-medium text-[#1d4ed8] underline underline-offset-4"
            >
              Privacy Policy
            </button>
          </span>
        </label>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-500">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#1d4ed8]" />
          We use this acknowledgment for new account creation only. Existing sign-in behavior remains unchanged.
        </div>
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-xl bg-[#0f172a] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] hover:bg-[#111827]"
        disabled={loading || !canContinue}
      >
        {loading ? "Preparing your workspace..." : "Create Account"}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            Or continue with
          </span>
        </div>
      </div>

      <div className="space-y-3">{socialButtons}</div>
    </form>
  );
}
