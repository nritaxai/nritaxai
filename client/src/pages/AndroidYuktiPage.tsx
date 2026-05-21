import { Capacitor } from "@capacitor/core";
import { Bot } from "lucide-react";
import { Navigate } from "react-router-dom";

import { YuktiWidget } from "../app/components/YuktiWidget";

export function AndroidYuktiPage() {
  const isNative = Capacitor.isNativePlatform(); // Android only
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
    return <Navigate to="/home" replace />; // Android only
  }

  if (!hasAcceptedTerms) {
    return <Navigate to="/profile" replace state={{ requiresLegalAcceptance: true, returnTo: "/android-yukti" }} />;
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        backgroundColor: "#1a3cff",
      }}
    >
      <div
        style={{
          backgroundColor: "#1a3cff",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          color: "white",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1a3cff",
          }}
        >
          <Bot size={20} />
        </div>
        <div>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            YUKTI
          </div>
          <div
            style={{
              fontSize: "12px",
              opacity: 0.8,
            }}
          >
            Your NRI Tax Assistant
          </div>
        </div>
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            marginLeft: "auto",
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          backgroundColor: "#f8f9fa",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <YuktiWidget fullScreen={true} androidMode={true} />
      </div>
    </main>
  );
}
