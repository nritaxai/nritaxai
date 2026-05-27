import { Capacitor } from "@capacitor/core";
import { AndroidLoginScreen } from "../../components/AndroidLoginScreen";
import { LoginModal } from "../components/LoginModal";
import { useNavigate, useSearchParams } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const redirectTo = searchParams.get("redirect") || "/home";
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  return (
    <div className="min-h-dvh bg-[#020617]">
      {isAndroidNative ? (
        <AndroidLoginScreen
          onClose={() => navigate("/")}
          disableClose
          onLoginSuccess={() => navigate("/home", { replace: true })}
        />
      ) : (
        <LoginModal
          initialMode={mode}
          presentation="page"
          disableClose
          redirectTo={redirectTo}
          onModeChange={(nextMode) => {
            const params = new URLSearchParams(searchParams);
            params.set("mode", nextMode);
            setSearchParams(params, { replace: true });
          }}
          onClose={() => navigate("/home")}
        />
      )}
    </div>
  );
}





