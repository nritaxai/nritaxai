import express from "express";
import multer from "multer";
import { protect } from "../Middlewares/authMiddleware.js";
import {
  askPdf,
  deletePdf,
  getKnowledgeBaseDocuments,
  getKnowledgeIngestionLogs,
  getPdfJobStatus,
  listPdfs,
  reindexPdfs,
  uploadPdfs,
} from "../Controllers/pdfController.js";
import { ensureDocumentProcessingStorage, getPdfProcessingTempDir } from "../services/documentProcessingService.js";
import { requirePermissions } from "../services/enterpriseAccess.js";

const router = express.Router();
ensureDocumentProcessingStorage();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, getPdfProcessingTempDir());
    },
    filename: (_req, file, cb) => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, `${suffix}-${file.originalname.replace(/[^\w.\-]+/g, "_")}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdf) return cb(new Error("Only PDF files are allowed."));
    cb(null, true);
  },
});

router.post("/upload-pdfs", protect, requirePermissions(["documents:write"]), upload.array("files", 20), uploadPdfs);
router.post("/reindex", protect, requirePermissions(["documents:write"]), reindexPdfs);
router.get("/list-pdfs", protect, requirePermissions(["documents:read"]), listPdfs);
router.get("/jobs/:jobId", protect, requirePermissions(["documents:read"]), getPdfJobStatus);
router.get("/knowledge-documents", protect, requirePermissions(["documents:read"]), getKnowledgeBaseDocuments);
router.get("/knowledge-ingestion-logs", protect, requirePermissions(["documents:read"]), getKnowledgeIngestionLogs);
router.delete("/delete-pdf/:name", protect, requirePermissions(["documents:write"]), deletePdf);
router.post("/ask", protect, askPdf);

export default router;
