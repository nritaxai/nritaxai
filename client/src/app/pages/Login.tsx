import { LoginModal } from "../components/LoginModal";
import { useNavigate } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <LoginModal onClose={() => navigate('/')} />
    </div>
  );
}






