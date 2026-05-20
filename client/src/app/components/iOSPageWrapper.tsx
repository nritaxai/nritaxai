import type { ReactNode } from "react";
import { IS_IOS_NATIVE_APP } from "../../config/appConfig";

// iOS only
interface iOSPageWrapperProps {
  children: ReactNode;
}

export function iOSPageWrapper({ children }: iOSPageWrapperProps) {
  if (!IS_IOS_NATIVE_APP) return <>{children}</>;

  return (
    <div
      className="ios-scroll"
      style={{
        paddingTop: "calc(44px + env(safe-area-inset-top))",
        paddingBottom: "calc(49px + env(safe-area-inset-bottom))",
        minHeight: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        backgroundColor: "#f2f2f7",
      }}
    >
      {children}
    </div>
  );
}

export default iOSPageWrapper;
