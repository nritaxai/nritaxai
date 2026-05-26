import { Capacitor } from "@capacitor/core";
import { LoginModal } from "../components/LoginModal";
import { useNavigate, useSearchParams } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  return (
    <div className="min-h-dvh bg-[#020617]">
      <LoginModal
        initialMode={mode}
        onClose={() => navigate(isAndroidNative ? "/" : "/home")}
        disableClose={isAndroidNative}
        hideSupportBanner={isAndroidNative}
        hideSocialSection={false}
      />
    </div>
  );
}





