import type { CSSProperties } from "react";

// Android only
export const ANDROID_NAVY_BACKGROUND =
  "linear-gradient(160deg, #0a1f5c 0%, #0d2878 40%, #0a1a4a 100%)";

// Android only
export const ANDROID_THEME = {
  background: ANDROID_NAVY_BACKGROUND,
  cardBackground: "rgba(255,255,255,0.10)",
  cardBorder: "1px solid rgba(255,255,255,0.18)",
  cardRadius: "14px",
  primaryText: "#ffffff",
  secondaryText: "rgba(255,255,255,0.6)",
  mutedText: "rgba(255,255,255,0.4)",
  accent: "#4285F4",
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
          background: "rgba(30,80,200,0.3)",
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
          background: "rgba(20,60,180,0.4)",
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
            color: "rgba(255,255,255,0.05)",
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
