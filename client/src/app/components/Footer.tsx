import { Link } from "react-router-dom";
import { AlertTriangle, Lock, Shield } from "lucide-react";

import { renderTextWithShortForms } from "../utils/shortForms";

const quickLinks = [
  { label: "AI Tax Assistant", to: "/chat" },
  { label: "Tax Calculators", to: "/calculators" },
  { label: "DTAA Guide", to: "/home#tax-updates" },
] as const;

const legalLinks = [
  { label: "Privacy Policy", to: "/privacy-policy", state: { fromSite: true } },
  { label: "Terms of Service", to: "/terms-and-conditions" },
  { label: "Disclaimer", to: "/disclaimer" },
  { label: "Refund Policy", to: "/refund-policy" },
] as const;

export function Footer() {
  return (
    <footer className="mt-auto bg-slate-900 text-slate-200">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center">
              <img
                src="/logo-transparent.png"
                alt="NRITAX logo"
                className="h-20 w-auto scale-110 object-contain sm:h-24"
              />
            </div>
            <p className="mb-3 text-sm font-medium text-slate-300">
              {renderTextWithShortForms("World's First AI-Powered NRI Tax Platform")}
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((item) => (
                <li key={item.label}>
                  <Link className="text-sm text-slate-400 transition-colors hover:text-white" to={item.to} state={item.state}>
                    {renderTextWithShortForms(item.label)}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://calendly.com/logan786-jkt/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 transition-colors hover:text-white"
                >
                  Expert Consultation
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Legal</h3>
            <ul className="space-y-3">
              {legalLinks.map((item) => (
                <li key={item.label}>
                  <Link className="text-sm text-slate-400 transition-colors hover:text-white" to={item.to} state={item.state}>
                    {renderTextWithShortForms(item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-8 rounded border-l-4 border-amber-500 bg-slate-800/50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div>
              <h4 className="mb-2 text-sm font-semibold text-white">Important Disclaimer</h4>
              <p className="text-xs leading-relaxed text-slate-300">
                NRITAX.AI provides AI-assisted tax information and connects users with qualified tax professionals.
                AI responses are for general guidance only and do not constitute professional tax, legal, or financial advice.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8">
          <div className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Shield className="size-4" />
                <span>{renderTextWithShortForms("SSL Secured")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="size-4" />
                <span>Data Protected</span>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500">© 2026 NRITAX.AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}


