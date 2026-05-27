import type { ReactNode } from "react";

import { AndroidPageWrapper } from "./AndroidPageWrapper";
import { ANDROID_THEME } from "../../components/androidTheme";

type AndroidNavWrapperProps = {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  className?: string;
};

export function AndroidNavWrapper({
  children,
  title = "NRITAX.AI",
  showBack = true,
  className = "",
}: AndroidNavWrapperProps) {
  return (
    <AndroidPageWrapper className={className}>
      <div
        data-android-nav-wrapper
        data-title={title}
        data-show-back={showBack ? "true" : "false"}
        style={{
          minHeight: "calc(100dvh - 56px - env(safe-area-inset-top) - 60px - env(safe-area-inset-bottom, 16px))",
          background: ANDROID_THEME.background,
          color: ANDROID_THEME.primaryText,
          fontFamily: ANDROID_THEME.fontFamily,
        }}
      >
        {children}
      </div>
    </AndroidPageWrapper>
  );
}

export default AndroidNavWrapper;
