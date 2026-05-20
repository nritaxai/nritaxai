import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";
import App from "./app/App";
import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
import { GOOGLE_AUTH_CONFIG } from "./config/appConfig";
import "./styles/index.css";

type NativeWrapperWindow = Window & {
  __NRITAX_IOS_WRAPPER__?: boolean;
};

const isIosNativeWrapper =
  typeof window !== "undefined" &&
  (Boolean((window as NativeWrapperWindow).__NRITAX_IOS_WRAPPER__) ||
    window.localStorage.getItem("nritax_ios_wrapper") === "true" ||
    /NRITAXIOSWrapper/i.test(window.navigator.userAgent));

const Router = Capacitor.isNativePlatform() || isIosNativeWrapper ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <Router>
    <AppErrorBoundary>
      {GOOGLE_AUTH_CONFIG.clientId ? (
        <GoogleOAuthProvider clientId={GOOGLE_AUTH_CONFIG.clientId}>
          <App />
        </GoogleOAuthProvider>
      ) : (
        <App />
      )}
    </AppErrorBoundary>
  </Router>
);
