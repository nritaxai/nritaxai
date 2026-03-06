import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "../components/ui/button";

export function HeroPage() {
  return (
    <div className="relative min-h-[calc(100vh-160px)] overflow-hidden bg-gradient-to-b from-transparent via-[#2563eb]/5 to-transparent">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#2563eb]/18 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#2563eb]/20 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-20 text-center sm:py-28">
        <p className="reveal-drop mb-3 rounded-full border border-[#E2E8F0] bg-[#F7FAFC]/75 px-4 py-1 text-xs tracking-wide text-[#2563eb]">
          AI Tax Platform for NRIs
        </p>

        <h1 className="reveal-drop reveal-delay-1 text-4xl tracking-tight text-[#0F172A] sm:text-6xl">
          NRITAX<span className="text-[#2563eb]">.AI</span>
        </h1>

        <p className="reveal-drop reveal-delay-2 mt-5 max-w-2xl text-base text-[#0F172A] sm:text-lg">
          Smart NRI tax guidance, instant AI help, and practical next steps in one place.
        </p>

        <div className="reveal-drop reveal-delay-3 mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" variant="outline">
            <Link to="/home">Enter Website</Link>
          </Button>
          <Button asChild size="lg" className="bg-[#2563eb] text-[#0F172A] hover:opacity-95">
            <Link to="/chat">
              Start AI Chat
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/pricing">View Pricing</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}












