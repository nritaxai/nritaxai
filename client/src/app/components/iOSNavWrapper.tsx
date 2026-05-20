import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { IS_IOS_NATIVE_APP } from "../../config/appConfig";

// iOS only
interface iOSNavWrapperProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

export function iOSNavWrapper({
  children,
  title = "NRITAX.AI",
  showBack = false,
}: iOSNavWrapperProps) {
  const navigate = useNavigate();

  if (!IS_IOS_NATIVE_APP) return <>{children}</>;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        backgroundColor: "#f2f2f7",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(26,60,255,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          height: "calc(44px + env(safe-area-inset-top))",
          display: "flex",
          alignItems: "flex-end",
          padding: "0 16px",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "8px",
          zIndex: 99999,
          borderBottom: "0.5px solid rgba(255,255,255,0.24)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif",
        }}
      >
        {showBack ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              color: "white",
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              minWidth: "60px",
              padding: 0,
            }}
          >
            ‹ Back
          </button>
        ) : (
          <div style={{ minWidth: "60px" }} />
        )}
        <span
          style={{
            color: "white",
            fontWeight: 600,
            fontSize: "17px",
            flex: 1,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
        <div style={{ minWidth: "60px" }} />
      </div>

      <div
        className="ios-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          marginTop: "calc(44px + env(safe-area-inset-top))",
          marginBottom: "calc(49px + env(safe-area-inset-bottom))",
          backgroundColor: "#f2f2f7",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default iOSNavWrapper;
