import express from "express";
import multer from "multer";
import { protect } from "../Middlewares/authMiddleware.js";
import { askPdf, deletePdf, listPdfs, uploadPdfs } from "../Controllers/pdfController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdf) return cb(new Error("Only PDF files are allowed."));
    cb(null, true);
  },
});

router.post("/upload-pdfs", protect, upload.array("files", 20), uploadPdfs);
router.get("/list-pdfs", protect, listPdfs);
router.delete("/delete-pdf/:name", protect, deletePdf);
router.post("/ask", protect, askPdf);

export default router;

