import { indexStoredPdfByName, rebuildPdfIndex } from "../../services/pdfIndexService.js";

export const processPdfIndexFile = async (payload) => {
  return indexStoredPdfByName(String(payload?.fileName || "").trim());
};

export const processPdfReindexAll = async () => {
  return rebuildPdfIndex();
};
