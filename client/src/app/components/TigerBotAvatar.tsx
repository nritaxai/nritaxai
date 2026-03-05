import { Bot } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export function TigerBotAvatar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleOpenChat = () => {
    if (location.pathname === "/chat") return;
    navigate("/chat");
  };

  return (
    <button
      type="button"
      onClick={handleOpenChat}
      aria-label="Open Nexa AI chat"
      className="group fixed bottom-20 right-4 z-[80] flex items-center gap-2 rounded-full border border-[#1E40AF] bg-[#2563EB]/95 p-2 pr-3 text-white shadow-xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
    >
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1E3A8A] shadow-md">
        <Bot className="size-6" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
      </span>
      <span className="text-sm font-semibold text-white">Nexa</span>
    </button>
  );
}
