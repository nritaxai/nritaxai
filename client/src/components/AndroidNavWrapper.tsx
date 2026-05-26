import type { ReactNode } from "react";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";

import { ANDROID_THEME } from "./androidTheme";

interface AndroidNavWrapperProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

const HOME_ROUTES = ["/", "/home", "/hero", "/Hero"];

// Android only
export function AndroidNavWrapper({
  children,
  title = "NRITAX.AI",
  showBack,
}: AndroidNavWrapperProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isNative = Capacitor.isNativePlatform();
  const isHome = HOME_ROUTES.includes(location.pathname);
  const shouldShowBack = showBack ?? !isHome;

  const handleBackNavigation = () => {
    const historyIndex =
      typeof window !== "undefined" && typeof window.history.state?.idx === "number"
        ? window.history.state.idx
        : 0;

    if (historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate("/home", { replace: true });
  };

  useEffect(() => {
    if (!isNative) return;

    let listener: { remove: () => Promise<void> | void } | null = null;

    const setupBackHandler = async () => {
      listener = await CapApp.addListener("backButton", () => {
        if (isHome) {
          CapApp.exitApp();
          return;
        }

        handleBackNavigation();
      });
    };

    void setupBackHandler();

    return () => {
      void listener?.remove();
    };
  }, [handleBackNavigation, isHome, isNative]);

  if (!isNative) {
    return <>{children}</>;
  }

  const headerHeight = "calc(56px + env(safe-area-inset-top))";
  const bottomOffset = "calc(60px + env(safe-area-inset-bottom))";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: ANDROID_THEME.background,
        fontFamily: ANDROID_THEME.fontFamily,
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: headerHeight,
          background: "rgba(10,31,92,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "env(safe-area-inset-top)",
          paddingInline: "14px",
          zIndex: 99999,
        }}
      >
        {shouldShowBack ? (
          <button
            type="button"
            onClick={handleBackNavigation}
            style={{
              position: "absolute",
              left: "14px",
              background: "transparent",
              border: 0,
              color: "#ffffff",
              fontSize: "20px",
            }}
            aria-label="Go back"
          >
            {"\u2190"}
          </button>
        ) : null}

        <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "13px" }}>{title}</span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          marginTop: headerHeight,
          marginBottom: bottomOffset,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default AndroidNavWrapper;
