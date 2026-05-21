import { LegalDocumentViewer } from "../components/LegalDocumentViewer";
import { COMPANY_LEGAL_NAME, LEGAL_PDF_PATHS } from "../../config/branding";

export function RefundPolicy() {
  return (
    <LegalDocumentViewer
      title="Refund Policy"
      subtitle={`Official refund policy for ${COMPANY_LEGAL_NAME}`}
      pdfPath={LEGAL_PDF_PATHS.refund}
      summary={`The official refund policy for ${COMPANY_LEGAL_NAME} is shown below and is also available to open in a new tab or download.`}
      metadataDescription={`Review the official refund policy for ${COMPANY_LEGAL_NAME}.`}
    />
  );
}
