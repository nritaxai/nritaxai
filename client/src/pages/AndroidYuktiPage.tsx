import { Capacitor } from "@capacitor/core";
import { Navigate } from "react-router-dom";

import { YuktiWidget } from "../app/components/YuktiWidget";
import { AndroidPageWrapper } from "../app/components/AndroidPageWrapper";

export function AndroidYuktiPage() {
  const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  let storedUser: Record<string, unknown> | null = null;
  if (typeof window !== "undefined") {
    try {
      storedUser = JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      storedUser = null;
    }
  }
  const hasAcceptedTerms = Boolean(storedUser?.termsAccepted);

  if (!isNative) {
    return <Navigate to="/home" replace />;
  }

  if (!hasAcceptedTerms) {
    return <Navigate to="/profile" replace state={{ requiresLegalAcceptance: true, returnTo: "/android-yukti" }} />;
  }

  return (
    <AndroidPageWrapper className="bg-transparent" scrollable={false}>
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "calc(100dvh - 56px - 60px)",
          background: "linear-gradient(160deg,#F5E6D3,#EDD5B0,#E8C99A)",
          fontFamily: "system-ui,-apple-system,sans-serif",
        }}
      >
        <div
          style={{
            margin: "14px 16px 0",
            borderRadius: "18px",
            border: "1px solid rgba(255,255,255,0.9)",
            background: "rgba(255,255,255,0.65)",
            overflow: "hidden",
            flex: 1,
            minHeight: 0,
          }}
        >
          <YuktiWidget fullScreen={true} androidMode={true} />
        </div>
      </main>
    </AndroidPageWrapper>
  );
}
