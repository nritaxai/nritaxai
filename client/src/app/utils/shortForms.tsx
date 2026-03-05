import { Fragment, type ReactNode } from "react";

import { ShortFormLink } from "../components/ShortFormLink";

const SHORT_FORMS: Record<string, string> = {
  "DTAA": "Double Taxation Avoidance Agreement",
  "NRI": "Non-Resident Indian",
  "NRIs": "Non-Resident Indians",
  "CPA": "Certified Public Accountant",
  "ITR": "Income Tax Return",
  "TRC": "Tax Residency Certificate",
  "RNOR": "Resident but Not Ordinarily Resident",
  "SSL": "Secure Sockets Layer",
  "SOC": "System and Organization Controls",
  "MLI": "Multilateral Instrument",
  "PAN": "Permanent Account Number",
  "NRE": "Non-Resident External",
  "NRO": "Non-Resident Ordinary",
  "NRO/NRE": "Non-Resident Ordinary / Non-Resident External",
  "LTCG": "Long-Term Capital Gains",
  "STCG": "Short-Term Capital Gains",
  "INR": "Indian Rupee",
  "ICAI": "Institute of Chartered Accountants of India",
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SHORT_FORM_REGEX = new RegExp(
  `(${Object.keys(SHORT_FORMS)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")})`,
  "g"
);

export function renderTextWithShortForms(text: string): ReactNode {
  const parts = text.split(SHORT_FORM_REGEX);
  return parts.map((part, index) => {
    const fullForm = SHORT_FORMS[part];
    if (!fullForm) return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    return <ShortFormLink key={`${part}-${index}`} shortForm={part} fullForm={fullForm} />;
  });
}
