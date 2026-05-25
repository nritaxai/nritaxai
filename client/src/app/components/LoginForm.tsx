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
      <Label className="text-sm font-medium text-white">{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[rgba(230,236,244,0.72)]" />
        <Input
          className={`h-14 rounded-[22px] border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.96)] pl-11 pr-12 text-[#172033] placeholder:text-[#94a3b8] shadow-none focus-visible:border-[rgba(255,255,255,0.4)] focus-visible:ring-white/10 ${className || ""}`}
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
            className="inline-flex size-9 items-center justify-center rounded-full text-[#334155] transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-[rgba(230,236,244,0.70)]">
          Secure sign in to access chats, subscriptions, and tax tools.
        </p>
        <button
          type="button"
          className="text-sm font-medium text-[#f5ede4] transition-colors hover:text-white"
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
            <div className="rounded-[22px] border border-white/14 bg-white/10 p-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-password-email" className="text-sm font-medium text-white">
                  Reset Email
                </Label>
                <Input
                  id="forgot-password-email"
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(event) => onForgotPasswordEmailChange(event.target.value)}
                  placeholder="your.email@example.com"
                  className="h-12 rounded-[20px] border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.96)] text-[#172033] placeholder:text-[#94a3b8] focus-visible:border-[rgba(255,255,255,0.4)] focus-visible:ring-white/10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11 w-full rounded-full border-white/18 bg-white/12 text-white hover:bg-white/18"
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
            className="flex items-start gap-3 rounded-[22px] border border-[#f5d7a6]/40 bg-[#f6deb7]/14 px-4 py-3 text-sm text-[#fff0d7]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="leading-6">{error}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Button
        type="submit"
        className="h-14 w-full rounded-full bg-[#f5ede4] text-sm font-semibold text-[#111827] shadow-[0_18px_36px_rgba(245,237,228,0.16)] hover:bg-[#fff7ef]"
        disabled={loading}
      >
        {loading ? "Processing..." : "Log in"}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/12" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-transparent px-3 text-xs font-medium uppercase tracking-[0.16em] text-[rgba(230,236,244,0.52)]">
            Or continue with
          </span>
        </div>
      </div>

      <div className="space-y-3">{socialButtons}</div>
    </form>
  );
}
