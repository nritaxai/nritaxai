import { Github, Linkedin, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
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
  { label: "GitHub", href: "https://github.com/nritaxai/Nritaxai", icon: Github },
] as const;

const footerLinkClass =
  "text-sm font-normal text-slate-400 transition-colors duration-200 hover:text-white hover:underline";

export function Footer() {
  return (
    <motion.footer
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeUp}
      className="mt-auto border-t border-slate-800 bg-black"
    >
      <div className="mx-auto max-w-7xl px-6 py-12">
        <motion.div
          variants={staggerContainer(0.06, 0.06)}
          className="hidden gap-10 border-b border-slate-800 pb-10 md:grid md:grid-cols-3 lg:grid-cols-5"
        >
          {footerColumns.map((column) => (
            <motion.div key={column.heading} variants={fadeUp}>
              <h2 className="mb-4 text-sm font-medium text-white">{column.heading}</h2>
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

        <div className="border-b border-slate-800 pb-8 md:hidden">
          <Accordion type="single" collapsible className="w-full">
            {footerColumns.map((column) => (
              <AccordionItem key={column.heading} value={column.heading} className="border-slate-800">
                <AccordionTrigger className="py-4 text-sm font-medium text-white hover:text-white hover:no-underline">
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
          <div className="flex flex-col gap-4">
            <Link to="/home" className="inline-flex items-center" aria-label="NRITAX home">
              <img src="/logo-transparent.png" alt="NRITAX logo" className="h-14 w-auto object-contain" />
            </Link>
            <p className="text-sm font-normal text-slate-400">
              © 2026 NRITAX. {renderTextWithShortForms("AI-powered tax guidance for global NRIs.")}
            </p>
          </div>

          <div className="flex flex-col gap-4 md:items-end">
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
                    className="text-slate-400 transition-colors duration-200 hover:text-white"
                  >
                    <Icon className="size-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
