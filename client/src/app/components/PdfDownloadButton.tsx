import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { getStoredAuthToken } from "../../utils/api";

type PdfDownloadButtonProps = {
  onRequireLogin: () => void;
  reportData: unknown;
};

export function PdfDownloadButton({ onRequireLogin, reportData }: PdfDownloadButtonProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownload = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      onRequireLogin();
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const { generateTaxReportPDF } = await import("./TaxReportPDF");
      generateTaxReportPDF(reportData);
    } catch (error: any) {
      toast.error(error?.message || "Failed to download the PDF report.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="w-full sm:w-auto"
      onClick={() => void handleDownload()}
      disabled={isGeneratingPdf}
    >
      <Download className="size-4 mr-2" />
      {isGeneratingPdf ? "Preparing PDF..." : "Download PDF"}
    </Button>
  );
}
