import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import App from "./app/App";
import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
import { GOOGLE_AUTH_CONFIG } from "./config/appConfig";
import { initializeGoogleSignIn } from "./services/googleSignIn";
import "./styles/index.css";

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

function RootApp() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    void initializeGoogleSignIn();

    // Hide the native splash screen after the first React mount so users see the app shell, not a blank screen.
    void SplashScreen.hide();
  }, []);

  return (
    <AppErrorBoundary>
      {GOOGLE_AUTH_CONFIG.clientId ? (
        <GoogleOAuthProvider clientId={GOOGLE_AUTH_CONFIG.clientId}>
          <App />
        </GoogleOAuthProvider>
      ) : (
        <App />
      )}
    </AppErrorBoundary>
  );
}

createRoot(document.getElementById("root")!).render(
  <Router>
    <RootApp />
  </Router>
);
