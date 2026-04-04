import { LegalDocumentViewer } from "../components/LegalDocumentViewer";

export function RefundPolicy() {
  return (
    <LegalDocumentViewer
      title="Refund Policy"
      subtitle="Official NRITaxAI refund policy document"
      pdfPath="/legal/nritaxai-refund-policy.pdf"
      summary="The uploaded refund policy PDF is shown below and is also available to open in a new tab or download."
    />
  );
}
