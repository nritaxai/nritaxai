import { Button } from "./ui/button";
import { ArrowRight, Calculator, MessageSquare, ShieldCheck } from "lucide-react";

interface HeroProps {
  onAskAI: () => void;
  onContactCPA: () => void;
}

export function Hero({ onAskAI, onContactCPA }: HeroProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#1d4ed8] via-[#1d4ed8] to-[#1d4ed8]">
      <div className="pointer-events-none absolute -top-24 -left-28 h-72 w-72 rounded-full bg-[#2563eb]/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-20 h-64 w-64 rounded-full bg-[#2563eb]/12 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2563eb]/40 bg-[#F7FAFC]/70 px-4 py-1.5 text-xs text-[#2563eb] shadow-sm mb-6">
            <ShieldCheck className="size-3.5" />
            <span className="[word-spacing:0.2rem]">Trusted NRITAX Platform</span>
          </div>

          <div className="mb-6 flex items-center justify-center">
            <h1 className="text-4xl sm:text-6xl tracking-tight text-[#0F172A]">
              NRITAX<span className="text-[#2563eb]">.AI</span>
            </h1>
          </div>

          <p className="mt-6 text-xl sm:text-2xl max-w-3xl mx-auto text-[#0F172A]">
            AI-Powered Tax Solutions for Non-Resident Indians
          </p>

          <p className="mt-4 text-base sm:text-lg max-w-2xl mx-auto text-[#0F172A]">
            Navigate global tax complexities and DTAA regulations with instant AI answers in 4 languages, backed by expert guidance.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              onClick={onAskAI}
              className="bg-[#2563eb] text-[#0F172A] hover:opacity-95 text-base sm:text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              <MessageSquare className="size-5 mr-2" />
              Ask AI Instantly
              <ArrowRight className="size-4 ml-2" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={onContactCPA}
              className="border-2 border-[#2563eb]/40 bg-[#F7FAFC]/80 text-[#2563eb] hover:bg-[#2563eb]/12 text-base sm:text-lg px-8 py-6 rounded-full"
            >
              <Calculator className="size-5 mr-2" />
              Consult a CPA
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/80 px-5 py-4 shadow-sm">
              <div className="text-3xl sm:text-4xl text-[#0F172A]">2.5Cr+</div>
              <div className="text-sm text-[#0F172A] mt-1">Tax Savings</div>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/80 px-5 py-4 shadow-sm">
              <div className="text-3xl sm:text-4xl text-[#0F172A]">24/7</div>
              <div className="text-sm text-[#0F172A] mt-1">AI Availability</div>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/80 px-5 py-4 shadow-sm">
              <div className="text-3xl sm:text-4xl text-[#0F172A]">&lt;2 min</div>
              <div className="text-sm text-[#0F172A] mt-1">Response Time</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}












