import { LegalDocumentViewer } from "../components/LegalDocumentViewer";

export function TermsAndConditions() {
  return (
    <LegalDocumentViewer
      title="Terms of Service"
      subtitle="Official NRITaxAI terms of service document"
      pdfPath="/legal/nritaxai-terms-of-service.pdf"
      summary="The uploaded terms of service PDF is shown below and is also available to open in a new tab or download."
    />
  );
}
