import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "../components/ui/button";

export function HeroPage() {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="relative min-h-[calc(100vh-160px)] overflow-hidden bg-gradient-to-b from-transparent via-[#2563eb]/5 to-transparent">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#2563eb]/18 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#2563eb]/20 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-16 text-center sm:py-20">
        <img
          src="/logo-transparent.png"
          alt="NRITAX logo"
          className="reveal-drop -ml-3 mb-1 h-32 w-auto object-contain sm:h-36"
        />

        <p className="reveal-drop mb-3 rounded-full border border-[#E2E8F0] bg-[#F7FAFC]/75 px-4 py-1 text-xs tracking-wide text-[#2563eb]">
          AI Tax Platform for NRIs
        </p>

        <h1 className="reveal-drop reveal-delay-1 text-4xl tracking-tight text-[#0F172A] sm:text-6xl">
          NRITAX<span className="text-[#2563eb]">.AI</span>
        </h1>

        <p className="reveal-drop reveal-delay-2 mt-4 max-w-2xl text-base text-[#0F172A] sm:text-lg">
          Smart NRI tax guidance, instant AI help, and practical next steps in one place.
        </p>

        <div className="reveal-drop reveal-delay-3 mt-10 flex flex-col gap-3 sm:flex-row">
          <Button type="button" size="lg" variant="outline" onClick={() => handleNavigate("/home")}>
            Enter Website
          </Button>
          <Button
            type="button"
            size="lg"
            className="bg-[#2563eb] text-[#0F172A] hover:opacity-95"
            onClick={() => handleNavigate("/chat")}
          >
            Start AI Chat
            <ArrowRight className="ml-2 size-4" />
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => handleNavigate("/pricing")}>
            View Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
