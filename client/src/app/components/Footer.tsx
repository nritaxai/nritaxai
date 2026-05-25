import { Instagram, Linkedin, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { COMPANY_COPYRIGHT_NAME, COMPANY_LEGAL_NAME, PLATFORM_TAGLINE } from "../../config/branding";
import { renderTextWithShortForms } from "../utils/shortForms";
import { fadeUp, staggerContainer } from "../utils/motion";

type FooterLink = {
  label: string;
  to: string;
  state?: Record<string, unknown>;
};

type FooterColumn = {
  heading: string;
  links: FooterLink[];
};

const footerColumns: FooterColumn[] = [
  {
    heading: "Services",
    links: [
      { label: "NRI Tax Filing", to: "/consult" },
      { label: "DTAA Advisory", to: "/home#tax-updates" },
      { label: "Capital Gains", to: "/chat" },
      { label: "Rental Income Tax", to: "/chat" },
      { label: "TDS Refund", to: "/consult" },
      { label: "Compliance", to: "/join-as-expert" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "AI Tax Assistant", to: "/chat" },
      { label: "Upload Documents", to: "/profile" },
      { label: "Dashboard", to: "/profile" },
      { label: "Reports", to: "/profile" },
      { label: "Pricing", to: "/pricing" },
      { label: "Security", to: "/privacy-policy", state: { fromSite: true } },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Help Center", to: "/consult" },
      { label: "Blog", to: "/home#tax-updates" },
      { label: "Tax Guides", to: "/calculators" },
      { label: "FAQs", to: "/disclaimer" },
      { label: "FEMA & RBI", to: "/terms-and-conditions" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", to: "/about-us" },
      { label: "Careers", to: "/join-as-expert" },
      { label: "Contact", to: "/consult" },
      { label: "Privacy Policy", to: "/privacy-policy", state: { fromSite: true } },
      { label: "Terms", to: "/terms-and-conditions" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Login", to: "/login" },
      { label: "Signup", to: "/login" },
      { label: "Partner With Us", to: "/join-as-expert" },
    ],
  },
] as const;

const socialLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com", icon: Linkedin },
  { label: "Twitter", href: "https://twitter.com", icon: Twitter },
  { label: "Instagram", href: "https://www.instagram.com", icon: Instagram },
] as const;

const footerLinkClass =
  "text-sm leading-6 text-slate-500 transition-colors duration-200 hover:text-slate-900";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={fadeUp}
      className="mt-auto border-t border-slate-200 bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-10 grid gap-8 border-b border-slate-200 pb-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="max-w-xl">
            <Link to="/home" className="inline-flex items-center" aria-label={`${COMPANY_LEGAL_NAME} home`}>
              <img src="/logo-transparent.png" alt={`${COMPANY_LEGAL_NAME} logo`} className="h-14 w-auto object-contain" />
            </Link>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {renderTextWithShortForms(PLATFORM_TAGLINE)} Built for global NRIs navigating tax, treaty, remittance, and compliance questions with more clarity.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Secure</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Privacy-first product design and structured account workflows.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Global</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Built for cross-border tax scenarios and country-aware guidance.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Expert-backed</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">AI guidance paired with premium consultation and onboarding support.</p>
            </div>
          </div>
        </div>

        <motion.div
          variants={staggerContainer(0.05, 0.05)}
          className="hidden gap-8 border-b border-slate-200 pb-10 md:grid md:grid-cols-3 lg:grid-cols-5"
        >
          {footerColumns.map((column) => (
            <motion.div key={column.heading} variants={fadeUp}>
              <h2 className="mb-4 text-sm font-semibold text-slate-900">{column.heading}</h2>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} state={link.state} className={footerLinkClass}>
                      {renderTextWithShortForms(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <div className="border-b border-slate-200 pb-8 md:hidden">
          <Accordion type="single" collapsible className="w-full">
            {footerColumns.map((column) => (
              <AccordionItem key={column.heading} value={column.heading} className="border-slate-200">
                <AccordionTrigger className="py-4 text-sm font-semibold text-slate-900 hover:text-slate-900 hover:no-underline">
                  {column.heading}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-3">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        <Link to={link.to} state={link.state} className={footerLinkClass}>
                          {renderTextWithShortForms(link.label)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="flex flex-col gap-6 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">
            © {currentYear} {COMPANY_COPYRIGHT_NAME}. {renderTextWithShortForms(PLATFORM_TAGLINE)}
          </p>

          <div className="flex items-center gap-4">
            {socialLinks.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:text-slate-900"
                >
                  <Icon className="size-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
