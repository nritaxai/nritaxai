import type { CSSProperties } from "react";

// Android only
export const ANDROID_NAVY_BACKGROUND =
  "linear-gradient(160deg, #e0f2fe 0%, #bae6fd 40%, #f0f9ff 100%)";

// Android only
export const ANDROID_THEME = {
  background: ANDROID_NAVY_BACKGROUND,
  cardBackground: "rgba(255,255,255,0.8)",
  cardBorder: "1px solid rgba(59,130,246,0.3)",
  cardRadius: "14px",
  primaryText: "#1e3a8a",
  secondaryText: "rgba(30,58,138,0.7)",
  mutedText: "rgba(30,58,138,0.5)",
  accent: "#2563eb",
  fontFamily: "system-ui,-apple-system,sans-serif",
  buttonRadius: "50px",
} as const;

// Android only
const currencySymbols = [
  { top: "16%", left: "8%", fontSize: "18px" },
  { top: "28%", right: "14%", fontSize: "22px" },
  { top: "44%", left: "68%", fontSize: "28px" },
  { top: "67%", right: "8%", fontSize: "20px" },
  { top: "82%", left: "18%", fontSize: "24px" },
];

// Android only
export function AndroidDecorBackground() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "-40px",
          left: "-40px",
          width: "150px",
          height: "150px",
          borderRadius: "50%",
          background: "rgba(59,130,246,0.3)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-20px",
          right: "-30px",
          width: "130px",
          height: "130px",
          borderRadius: "50%",
          background: "rgba(37,99,235,0.4)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {currencySymbols.map((symbol, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            color: "rgba(30,58,138,0.1)",
            fontWeight: 700,
            lineHeight: 1,
            ...(symbol as CSSProperties),
          }}
        >
          ₹
        </div>
      ))}
    </div>
  );
}
