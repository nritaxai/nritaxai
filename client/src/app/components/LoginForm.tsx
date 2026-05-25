import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type LoginFormProps = {
  loginData: {
    email: string;
    password: string;
  };
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  forgotPasswordMode: boolean;
  forgotPasswordEmail: string;
  onSubmit: (event: React.FormEvent) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onToggleForgotPassword: () => void;
  onForgotPasswordEmailChange: (value: string) => void;
  onForgotPassword: () => void;
  socialButtons: ReactNode;
};

type FieldProps = {
  label: string;
  icon: typeof Mail | typeof KeyRound;
  endAdornment?: ReactNode;
} & ComponentProps<typeof Input>;

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

export function LoginForm({
  loginData,
  showPassword,
  loading,
  error,
  forgotPasswordMode,
  forgotPasswordEmail,
  onSubmit,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onToggleForgotPassword,
  onForgotPasswordEmailChange,
  onForgotPassword,
  socialButtons,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field
        label="Email Address"
        icon={Mail}
        type="email"
        required
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="email"
        placeholder="your.email@example.com"
        value={loginData.email}
        onChange={(event) => onEmailChange(event.target.value)}
      />

      <Field
        label="Password"
        icon={KeyRound}
        type={showPassword ? "text" : "password"}
        required
        autoComplete="current-password"
        placeholder="Enter your password"
        value={loginData.password}
        onChange={(event) => onPasswordChange(event.target.value)}
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-500">
          Secure sign in to access chats, subscriptions, and tax tools.
        </p>
        <button
          type="button"
          className="text-sm font-medium text-[#1d4ed8] transition-colors hover:text-[#1e40af]"
          onClick={onToggleForgotPassword}
        >
          Forgot password?
        </button>
      </div>

      <AnimatePresence initial={false}>
        {forgotPasswordMode ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-password-email" className="text-sm font-medium text-slate-800">
                  Reset Email
                </Label>
                <Input
                  id="forgot-password-email"
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(event) => onForgotPasswordEmailChange(event.target.value)}
                  placeholder="your.email@example.com"
                  className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#1d4ed8] focus-visible:ring-[#1d4ed8]/10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11 w-full rounded-xl border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                disabled={loading}
                onClick={onForgotPassword}
              >
                {loading ? "Sending reset link..." : "Send Reset Link"}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

      <Button
        type="submit"
        className="h-12 w-full rounded-xl bg-[#0f172a] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] hover:bg-[#111827]"
        disabled={loading}
      >
        {loading ? "Processing..." : "Sign In"}
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
