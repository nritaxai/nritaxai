import React from "react";
import { renderToStream } from "@react-pdf/renderer";

import { TaxReportPDF } from "../src/pdf/TaxReportPDF.js";

const MAX_REPORT_ITEMS = 20;
const MAX_LABEL_LENGTH = 120;
const MAX_VALUE_LENGTH = 4000;
const MAX_NAME_LENGTH = 120;

const coerceSafeString = (value, maxLength) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
};

const validatePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Invalid request body." };
  }

  const userName = coerceSafeString(payload.userName, MAX_NAME_LENGTH);
  if (!userName) {
    return { error: "A valid userName is required." };
  }

  if (!Array.isArray(payload.reportData) || payload.reportData.length === 0 || payload.reportData.length > MAX_REPORT_ITEMS) {
    return { error: "reportData must be a non-empty array." };
  }

  const reportData = [];
  for (const item of payload.reportData) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each report item must be an object." };
    }

    const label = coerceSafeString(item.label, MAX_LABEL_LENGTH);
    const value = coerceSafeString(item.value, MAX_VALUE_LENGTH);
    if (!label || !value) {
      return { error: "Each report item requires valid label and value fields." };
    }

    reportData.push({ label, value });
  }

  return { userName, reportData };
};

export const generatePdf = async (req, res) => {
  const validatedPayload = validatePayload(req.body);
  if (validatedPayload.error) {
    return res.status(400).json({
      success: false,
      message: validatedPayload.error,
    });
  }

  try {
    const document = React.createElement(TaxReportPDF, validatedPayload);
    const pdfStream = await renderToStream(document);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="nritax-report.pdf"');
    res.setHeader("Cache-Control", "no-store");

    pdfStream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to generate the PDF right now.",
        });
      } else {
        res.end();
      }
    });

    return pdfStream.pipe(res);
  } catch {
    return res.status(500).json({
      success: false,
      message: "Unable to generate the PDF right now.",
    });
  }
};
