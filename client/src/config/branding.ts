export const COMPANY_LEGAL_NAME = "Billion Dollar Technologies Private Limited";
export const COMPANY_SHORT_NAME = "Billion Dollar Technologies";
export const COMPANY_SUPPORT_TEAM_NAME = `${COMPANY_SHORT_NAME} Team`;
export const COMPANY_COPYRIGHT_NAME = COMPANY_LEGAL_NAME;

export const PLATFORM_TAGLINE = "AI-powered tax guidance for global NRIs.";
export const DEFAULT_META_TITLE = `${COMPANY_LEGAL_NAME} | AI Tax Platform for NRIs`;
export const DEFAULT_META_DESCRIPTION =
  `${COMPANY_LEGAL_NAME} provides AI-assisted tax guidance, compliance support, consultations, and legal resources for global NRIs.`;

export const SITE_URL = String(import.meta.env.VITE_SITE_URL || "https://www.nritax.ai").trim();
export const SUPPORT_EMAIL = String(import.meta.env.VITE_CONTACT_EMAIL || "ask@nritax.ai").trim();

export const LEGAL_PDF_PATHS = {
  privacy: "/legal/nritaxai-privacy-policy.pdf",
  terms: "/legal/nritaxai-terms-of-service.pdf",
  disclaimer: "/legal/nritaxai-disclaimer.pdf",
  refund: "/legal/nritaxai-refund-policy.pdf",
} as const;

export const buildSupportMailto = (subject: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${subject} - ${COMPANY_LEGAL_NAME}`)}`;

export const applyDocumentMetadata = (title: string, description = DEFAULT_META_DESCRIPTION) => {
  if (typeof document === "undefined") return;

  document.title = title;

  const ensureMeta = (name: string, content: string, property?: boolean) => {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let element = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!element) {
      element = document.createElement("meta");
      if (property) {
        element.setAttribute("property", name);
      } else {
        element.setAttribute("name", name);
      }
      document.head.appendChild(element);
    }
    element.setAttribute("content", content);
  };

  ensureMeta("description", description);
  ensureMeta("og:title", title, true);
  ensureMeta("og:description", description, true);
  ensureMeta("twitter:title", title);
  ensureMeta("twitter:description", description);
};
