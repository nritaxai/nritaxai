import { Capacitor } from "@capacitor/core";
import { Bot } from "lucide-react";
import { Navigate } from "react-router-dom";

import { YuktiWidget } from "../app/components/YuktiWidget";

export function AndroidYuktiPage() {
  const isNative = Capacitor.isNativePlatform(); // Android only

  if (!isNative) {
    return <Navigate to="/home" replace />; // Android only
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        backgroundColor: "#1a3cff",
        paddingBottom: "calc(60px + env(safe-area-inset-bottom))",
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
