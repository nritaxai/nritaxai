import { Button } from "./ui/button";
import { ArrowRight, Calculator, Globe, MessageSquare, ShieldCheck } from "lucide-react";

interface HeroProps {
  onAskAI: () => void;
  onContactCPA: () => void;
}

export function Hero({ onAskAI, onContactCPA }: HeroProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50/40 to-white">
      <div className="pointer-events-none absolute -top-24 -left-28 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-20 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-1.5 text-xs text-blue-700 shadow-sm mb-6">
            <ShieldCheck className="size-3.5" />
            Trusted NRI Tax Platform
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <Globe className="size-10 text-blue-600" />
            <h1 className="text-4xl sm:text-6xl tracking-tight text-gray-900">
              NRITAX<span className="text-blue-600">.AI</span>
            </h1>
          </div>

          <p className="mt-6 text-xl sm:text-2xl max-w-3xl mx-auto text-gray-800">
            AI-Powered Tax Solutions for Non-Resident Indians
          </p>

          <p className="mt-4 text-base sm:text-lg max-w-2xl mx-auto text-gray-600">
            Navigate global tax complexities and DTAA regulations with instant AI answers in 4 languages, backed by expert guidance.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              onClick={onAskAI}
              className="bg-blue-600 text-white hover:bg-blue-700 text-base sm:text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              <MessageSquare className="size-5 mr-2" />
              Ask AI Instantly
              <ArrowRight className="size-4 ml-2" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={onContactCPA}
              className="border-2 border-blue-600 bg-white/80 text-blue-600 hover:bg-blue-50 text-base sm:text-lg px-8 py-6 rounded-full"
            >
              <Calculator className="size-5 mr-2" />
              Consult a CPA
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto">
            <div className="rounded-xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm">
              <div className="text-3xl sm:text-4xl text-gray-900">2.5Cr+</div>
              <div className="text-sm text-gray-600 mt-1">Tax Savings</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm">
              <div className="text-3xl sm:text-4xl text-gray-900">24/7</div>
              <div className="text-sm text-gray-600 mt-1">AI Availability</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm">
              <div className="text-3xl sm:text-4xl text-gray-900">&lt;2 min</div>
              <div className="text-sm text-gray-600 mt-1">Response Time</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
