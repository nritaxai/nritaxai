import {
  finalizePdfUpload,
  getStagedPdfSourcePath,
  loadPdfUploadManifest,
  moveFailedPdfUpload,
  removePdfUploadStage,
  updatePdfUploadManifest,
} from "../../services/documentProcessingService.js";
import { buildPdfIndexRowsFromFile, indexStoredPdfByName, rebuildPdfIndex, replacePdfIndexRows } from "../../services/pdfIndexService.js";
import { ingestKnowledgeDocumentFromFile } from "../../services/knowledgeBaseService.js";
import { recordDocumentProcessingMetric } from "../../services/metrics.js";

export const processPdfIndexFile = async (payload) => {
  const uploadId = String(payload?.uploadId || "").trim();
  const fileName = String(payload?.fileName || "").trim();

  if (!uploadId) {
    return indexStoredPdfByName(fileName);
  }

  const manifest = loadPdfUploadManifest(uploadId);
  if (!manifest) {
    throw new Error("Staged upload was not found.");
  }

  updatePdfUploadManifest(uploadId, { status: "processing" });
  const startedAt = Date.now();

  try {
    const sourcePath = getStagedPdfSourcePath(uploadId);
    const { rows, stats } = await buildPdfIndexRowsFromFile(sourcePath, manifest.safeName);
    const finalizedManifest = finalizePdfUpload(uploadId);
    await replacePdfIndexRows({
      fileName: manifest.safeName,
      rows,
    });
    const knowledgeResult = await ingestKnowledgeDocumentFromFile({
      fileName: manifest.safeName,
      filePath: finalizedManifest.finalPath,
      sourceType: manifest.sourceType || "other_pdf",
      jobId: uploadId,
      sourceUrl: manifest.sourceUrl || "",
      policyTags: manifest.policyTags || [],
      documentTitle: manifest.documentTitle || manifest.safeName,
      documentMetadata: {
        uploadId,
        requestedBy: manifest.requestedBy || "",
      },
    });
    removePdfUploadStage(uploadId);

    return {
      file: manifest.safeName,
      uploadId,
      chunks: rows.length,
      pages: stats.pages,
      sizeBytes: stats.sizeBytes,
      extractionMode: stats.extractionMode,
      parseDurationMs: stats.parseDurationMs,
      totalDurationMs: Date.now() - startedAt,
      storageStatus: finalizedManifest.status,
      knowledgeChunks: knowledgeResult?.chunkCount || 0,
      duplicateKnowledgeDocument: Boolean(knowledgeResult?.duplicate),
    };
  } catch (error) {
    const latestManifest = loadPdfUploadManifest(uploadId);
    recordDocumentProcessingMetric({
      workflow: "pdf-index",
      extractionMode: latestManifest?.sizeBytes ? "native_text" : "unknown",
      status: "failed",
      durationMs: Date.now() - startedAt,
      fileSizeBytes: latestManifest?.sizeBytes || 0,
      pages: 0,
    });
    if (latestManifest?.status === "stored") {
      updatePdfUploadManifest(uploadId, {
        status: "failed",
        failureReason: error?.message || String(error),
      });
    } else {
      moveFailedPdfUpload(uploadId, error?.message || String(error));
    }
    throw error;
  }
};

export const processPdfReindexAll = async () => {
  return rebuildPdfIndex();
};
