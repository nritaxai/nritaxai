import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";
import App from "./app/App";
import { GOOGLE_AUTH_CONFIG } from "./config/appConfig";
import "./styles/index.css";

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <Router>
    {GOOGLE_AUTH_CONFIG.clientId ? (
      <GoogleOAuthProvider clientId={GOOGLE_AUTH_CONFIG.clientId}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </Router>
);
