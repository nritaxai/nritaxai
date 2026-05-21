import { LegalDocumentViewer } from "../components/LegalDocumentViewer";
import { COMPANY_LEGAL_NAME, LEGAL_PDF_PATHS } from "../../config/branding";

export function TermsAndConditions() {
  return (
    <LegalDocumentViewer
      title="Terms of Service"
      subtitle={`Official terms of service for ${COMPANY_LEGAL_NAME}`}
      pdfPath={LEGAL_PDF_PATHS.terms}
      summary={`The official terms of service for ${COMPANY_LEGAL_NAME} are shown below and are also available to open in a new tab or download.`}
      metadataDescription={`Review the official terms of service for ${COMPANY_LEGAL_NAME}.`}
    />
  );
}
