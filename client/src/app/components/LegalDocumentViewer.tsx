import type { ReactNode } from "react";

import { ExternalLink, Download } from "lucide-react";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

type LegalDocumentViewerProps = {
  title: string;
  subtitle: string;
  pdfPath: string;
  summary: string;
  footer?: ReactNode;
};

export function LegalDocumentViewer({
  title,
  subtitle,
  pdfPath,
  summary,
  footer,
}: LegalDocumentViewerProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl text-[#0F172A] sm:text-4xl">{title}</CardTitle>
          <CardDescription className="text-base text-[#0F172A]">{subtitle}</CardDescription>
          <p className="text-sm text-[#0F172A]">{summary}</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button asChild type="button">
              <a href={pdfPath} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" />
                Open PDF
              </a>
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={pdfPath} download>
                <Download className="mr-2 size-4" />
                Download PDF
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white">
            <iframe
              title={title}
              src={pdfPath}
              className="h-[70vh] min-h-[720px] w-full"
            />
          </div>
          {footer ? (
            <div className="rounded-xl border border-[#DBEAFE] bg-white p-4">{footer}</div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
