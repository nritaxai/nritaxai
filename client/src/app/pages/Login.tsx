import { LoginModal } from "../components/LoginModal";
import { useNavigate, useSearchParams } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";

  return (
    <div className="min-h-dvh">
      <LoginModal initialMode={mode} onClose={() => navigate('/home')} />
    </div>
  );
}





