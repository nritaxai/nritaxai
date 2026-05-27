import { Capacitor } from "@capacitor/core";
import { AndroidLoginScreen } from "../../components/AndroidLoginScreen";
import { AuthModal } from "../components/AuthModal";
import { useNavigate, useSearchParams } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const redirectTo = searchParams.get("redirect") || "/home";
  const isNativePlatform = Capacitor.isNativePlatform();

  return (
    <div className="min-h-dvh bg-[#020617]">
      {isNativePlatform ? (
        <AndroidLoginScreen
          onClose={() => navigate("/")}
          disableClose
          onLoginSuccess={() => navigate("/home", { replace: true })}
        />
      ) : (
        <AuthModal
          initialMode={mode}
          redirectTo={redirectTo}
          onModeChange={(nextMode) => {
            const params = new URLSearchParams(searchParams);
            params.set("mode", nextMode);
            setSearchParams(params, { replace: true });
          }}
        />
      )}
    </div>
  );
}





