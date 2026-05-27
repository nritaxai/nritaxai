import type { ReactNode } from "react";
import { Capacitor } from "@capacitor/core";

type AndroidPageWrapperProps = {
  children: ReactNode;
  includeHeaderOffset?: boolean;
  includeBottomNavOffset?: boolean;
  className?: string;
  scrollable?: boolean;
};

export function AndroidPageWrapper({
  children,
  includeHeaderOffset = true,
  includeBottomNavOffset = true,
  className = "",
  scrollable = true,
}: AndroidPageWrapperProps) {
  const isNative = Capacitor.isNativePlatform(); // Android only

  if (!isNative) {
    return <>{children}</>;
  }

  return (
    <div
      data-android-page
      className={`android-page page-content ${className}`.trim()}
      style={{
        paddingTop: includeHeaderOffset ? "calc(56px + env(safe-area-inset-top))" : "0",
        paddingBottom: includeBottomNavOffset
          ? "calc(60px + env(safe-area-inset-bottom, 16px))"
          : "0",
        minHeight: "100dvh",
        overflowY: scrollable ? "auto" : "visible",
        WebkitOverflowScrolling: scrollable ? "touch" : "auto",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

export default AndroidPageWrapper;
