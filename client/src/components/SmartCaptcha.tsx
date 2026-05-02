import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import ReCAPTCHA from "react-google-recaptcha";

interface SmartCaptchaProps {
  onVerify: (token: string | null) => void;
  onExpire?: () => void;
}

const FALLBACK_RECAPTCHA_SITE_KEY = "6LfbPaEsAAAAAIRxHR8s1bZojFeuJoQ0Vgq2wSdo";

const SmartCaptcha = ({ onVerify, onExpire }: SmartCaptchaProps) => {
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
      // Android native apps bypass reCAPTCHA because Capacitor serves from localhost,
      // which Google reCAPTCHA does not support for this site key.
      onVerify("ANDROID_NATIVE_BYPASS");
    }
  }, [isNative, onVerify]);

  if (isNative) {
    // Android native apps bypass reCAPTCHA because Capacitor serves from localhost,
    // which Google reCAPTCHA does not support for this site key.
    return null;
  }

  return (
    <ReCAPTCHA
      sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || FALLBACK_RECAPTCHA_SITE_KEY}
      onChange={onVerify}
      onExpired={onExpire}
    />
  );
};

export default SmartCaptcha;
