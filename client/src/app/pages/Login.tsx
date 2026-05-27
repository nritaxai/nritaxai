import { Capacitor } from "@capacitor/core";
import { AndroidLoginScreen } from "../../components/AndroidLoginScreen";
import { LoginModal } from "../components/LoginModal";
import { useNavigate, useSearchParams } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
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
          onClose={() => navigate("/home")}
        />
      )}
    </div>
  );
}





