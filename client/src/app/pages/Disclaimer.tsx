import { LegalDocumentViewer } from "../components/LegalDocumentViewer";

export function Disclaimer() {
  return (
    <LegalDocumentViewer
      title="Disclaimer"
      subtitle="Official NRITaxAI disclaimer document"
      pdfPath="/legal/nritaxai-disclaimer.pdf"
      summary="The uploaded disclaimer PDF is shown below and is also available to open in a new tab or download."
    />
  );
}
