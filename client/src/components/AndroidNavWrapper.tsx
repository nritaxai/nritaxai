import type { ReactNode } from "react";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";

interface AndroidNavWrapperProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

const HOME_ROUTES = ["/", "/home", "/hero", "/Hero"];

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
          CapApp.exitApp(); // Android only
          return;
        }

        handleBackNavigation(); // Android only
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
        backgroundColor: "#f8f9fa",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: headerHeight,
          backgroundColor: "#1a3cff",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          zIndex: 99999,
          paddingTop: "env(safe-area-inset-top)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        {shouldShowBack ? (
          <button
            type="button"
            onClick={handleBackNavigation}
            style={{
              color: "white",
              background: "none",
              border: "none",
              fontSize: "26px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              marginRight: "4px",
            }}
            aria-label="Go back"
          >
            {"\u2190"}
          </button>
        ) : null}

        <span
          style={{
            color: "white",
            fontWeight: "bold",
            fontSize: "18px",
            flex: 1,
          }}
        >
          {title}
        </span>
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
