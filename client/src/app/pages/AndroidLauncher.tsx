import { Capacitor } from "@capacitor/core";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { AndroidDecorBackground, ANDROID_THEME } from "../../components/androidTheme";
import { getStoredAuthToken } from "../../utils/api";

export function AndroidLauncher() {
  const navigate = useNavigate();
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  useEffect(() => {
    if (!isAndroidNative) {
      navigate("/home", { replace: true });
      return;
    }

    const timer = window.setTimeout(() => {
      navigate(getStoredAuthToken() ? "/home" : "/login", { replace: true });
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [isAndroidNative, navigate]);

  return (
    <main
      className="flex min-h-dvh items-center justify-center px-8 text-center"
      style={{
        background: ANDROID_THEME.background,
        position: "relative",
        overflow: "hidden",
        fontFamily: ANDROID_THEME.fontFamily,
      }}
    >
      <AndroidDecorBackground />

      <div className="w-full max-w-sm" style={{ position: "relative", zIndex: 2 }}>
        <div className="mx-auto inline-flex size-24 items-center justify-center rounded-[32px] border border-white/15 bg-white/10 shadow-[0_24px_60px_rgba(5,17,40,0.34)] backdrop-blur-xl">
          <ShieldCheck className="size-12 text-[#f5ede4]" strokeWidth={1.8} />
        </div>
        <p className="mt-7 text-[15px] font-semibold uppercase tracking-[0.42em] text-white/80">
          NRITAX.AI
        </p>
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-white">
          Your AI Tax Assistant
        </h1>
        <p className="mt-4 text-base leading-7 text-[rgba(233,239,247,0.78)]">
          Reports, expert help, AI answers, and NRI tax tools in one Android workspace.
        </p>
        <div className="mx-auto mt-10 h-1.5 w-28 overflow-hidden rounded-full bg-white/12">
          <div className="h-full w-full animate-pulse rounded-full bg-[#f5ede4]" />
        </div>
      </div>
    </main>
  );
}

export default AndroidLauncher;
