import { LegalDocumentViewer } from "../components/LegalDocumentViewer";
import { COMPANY_LEGAL_NAME, LEGAL_PDF_PATHS } from "../../config/branding";

export function Disclaimer() {
  return (
    <LegalDocumentViewer
      title="Disclaimer"
      subtitle={`Official disclaimer for ${COMPANY_LEGAL_NAME}`}
      pdfPath={LEGAL_PDF_PATHS.disclaimer}
      summary={`The official disclaimer for ${COMPANY_LEGAL_NAME} is shown below and is also available to open in a new tab or download.`}
      metadataDescription={`Review the official disclaimer for ${COMPANY_LEGAL_NAME}.`}
    />
  );
}
