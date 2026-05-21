import crypto from "crypto";
import fs from "fs";
import path from "path";

const STORAGE_DIR = path.resolve(process.env.DOCUMENT_STORAGE_DIR || "storage");
const PDF_DIR = path.join(STORAGE_DIR, "pdfs");
const PIPELINE_DIR = path.join(STORAGE_DIR, "pdf-processing");
const TEMP_UPLOAD_DIR = path.join(PIPELINE_DIR, "tmp");
const STAGING_DIR = path.join(PIPELINE_DIR, "staging");
const FAILED_DIR = path.join(PIPELINE_DIR, "failed");
const MANIFEST_FILE = "manifest.json";
const SOURCE_FILE = "source.pdf";

const nowIso = () => new Date().toISOString();

const safeMkdir = (target) => {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
};

export const ensureDocumentProcessingStorage = () => {
  safeMkdir(STORAGE_DIR);
  safeMkdir(PDF_DIR);
  safeMkdir(PIPELINE_DIR);
  safeMkdir(TEMP_UPLOAD_DIR);
  safeMkdir(STAGING_DIR);
  safeMkdir(FAILED_DIR);
};

export const getDocumentStorageDir = () => STORAGE_DIR;
export const getPdfDir = () => PDF_DIR;
export const getPdfProcessingTempDir = () => {
  ensureDocumentProcessingStorage();
  return TEMP_UPLOAD_DIR;
};
export const getPdfProcessingStageDir = () => {
  ensureDocumentProcessingStorage();
  return STAGING_DIR;
};

export const sanitizePdfFilename = (name = "") =>
  path
    .basename(String(name || ""))
    .replace(/[^\w.\- ]/g, "_")
    .trim();

const makeId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sha256File = (targetPath) => {
  const hash = crypto.createHash("sha256");
  const buffer = fs.readFileSync(targetPath);
  hash.update(buffer);
  return hash.digest("hex");
};

const readPdfHeader = (targetPath) => {
  const fd = fs.openSync(targetPath, "r");
  try {
    const header = Buffer.alloc(5);
    fs.readSync(fd, header, 0, 5, 0);
    return header.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
};

const getStageDir = (uploadId) => path.join(STAGING_DIR, String(uploadId || ""));
const getManifestPath = (uploadId) => path.join(getStageDir(uploadId), MANIFEST_FILE);
const getSourcePath = (uploadId) => path.join(getStageDir(uploadId), SOURCE_FILE);

export const validatePdfUploadCandidate = ({ filePath, originalName = "", fileSize = 0, mimetype = "" }) => {
  const safeName = sanitizePdfFilename(originalName);
  if (!safeName || !safeName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are allowed.");
  }

  const maxFileSize = Math.max(Number(process.env.PDF_MAX_FILE_SIZE_BYTES || 20 * 1024 * 1024), 1024 * 1024);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Uploaded PDF is empty.");
  }
  if (fileSize > maxFileSize) {
    throw new Error(`Uploaded PDF exceeds the ${Math.floor(maxFileSize / (1024 * 1024))}MB limit.`);
  }

  const header = readPdfHeader(filePath);
  const normalizedMime = String(mimetype || "").trim().toLowerCase();
  if (header !== "%PDF-" || (normalizedMime && normalizedMime !== "application/pdf")) {
    throw new Error("Uploaded file is not a valid PDF.");
  }

  return { safeName, maxFileSize };
};

const normalizeSourceType = (value = "") => {
  const normalized = String(value || "").trim();
  const allowed = new Set([
    "dtaa_pdf",
    "tax_law",
    "fema_doc",
    "tds_rule",
    "capital_gains",
    "nri_compliance",
    "other_pdf",
  ]);
  return allowed.has(normalized) ? normalized : "other_pdf";
};

const normalizePolicyTags = (value = []) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
};

export const createPdfUploadManifest = ({
  file,
  requestedBy = "",
  requestId = "",
  sourceType = "other_pdf",
  sourceUrl = "",
  policyTags = [],
  documentTitle = "",
}) => {
  ensureDocumentProcessingStorage();
  const uploadId = makeId();
  const stageDir = getStageDir(uploadId);
  safeMkdir(stageDir);

  try {
    const { safeName } = validatePdfUploadCandidate({
      filePath: file.path,
      originalName: file.originalname,
      fileSize: file.size,
      mimetype: file.mimetype,
    });

    const sourcePath = getSourcePath(uploadId);
    fs.renameSync(file.path, sourcePath);

    const manifest = {
      uploadId,
      originalName: String(file.originalname || ""),
      safeName,
      sizeBytes: Number(file.size || 0),
      mimetype: String(file.mimetype || "application/pdf"),
      requestedBy: String(requestedBy || ""),
      requestId: String(requestId || ""),
      status: "staged",
      sourcePath,
      finalPath: "",
      checksumSha256: sha256File(sourcePath),
      sourceType: normalizeSourceType(sourceType),
      sourceUrl: String(sourceUrl || "").trim(),
      policyTags: normalizePolicyTags(policyTags),
      documentTitle: String(documentTitle || "").trim(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    fs.writeFileSync(getManifestPath(uploadId), JSON.stringify(manifest, null, 2), "utf8");
    return manifest;
  } catch (error) {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    if (fs.existsSync(stageDir)) {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
    throw error;
  }
};

export const loadPdfUploadManifest = (uploadId) => {
  ensureDocumentProcessingStorage();
  const manifestPath = getManifestPath(uploadId);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw);
};

export const updatePdfUploadManifest = (uploadId, patch = {}) => {
  const current = loadPdfUploadManifest(uploadId);
  if (!current) {
    throw new Error("Staged upload was not found.");
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };

  fs.writeFileSync(getManifestPath(uploadId), JSON.stringify(next, null, 2), "utf8");
  return next;
};

export const getStagedPdfSourcePath = (uploadId) => {
  const manifest = loadPdfUploadManifest(uploadId);
  if (!manifest?.sourcePath) {
    throw new Error("Staged upload source was not found.");
  }
  return manifest.sourcePath;
};

export const finalizePdfUpload = (uploadId) => {
  const manifest = loadPdfUploadManifest(uploadId);
  if (!manifest) {
    throw new Error("Staged upload was not found.");
  }

  ensureDocumentProcessingStorage();
  const finalPath = path.join(PDF_DIR, manifest.safeName);
  if (!fs.existsSync(manifest.sourcePath)) {
    throw new Error("Staged PDF content is missing.");
  }

  fs.renameSync(manifest.sourcePath, finalPath);
  return updatePdfUploadManifest(uploadId, {
    status: "stored",
    finalPath,
  });
};

export const moveFailedPdfUpload = (uploadId, reason = "") => {
  const manifest = loadPdfUploadManifest(uploadId);
  if (!manifest) return null;

  const failedDir = path.join(FAILED_DIR, uploadId);
  safeMkdir(failedDir);
  if (fs.existsSync(manifest.sourcePath)) {
    const failedPdfPath = path.join(failedDir, SOURCE_FILE);
    if (fs.existsSync(failedPdfPath)) fs.unlinkSync(failedPdfPath);
    fs.renameSync(manifest.sourcePath, failedPdfPath);
  }

  const failedManifestPath = path.join(failedDir, MANIFEST_FILE);
  const next = {
    ...manifest,
    status: "failed",
    failureReason: String(reason || ""),
    finalPath: "",
    sourcePath: path.join(failedDir, SOURCE_FILE),
    updatedAt: nowIso(),
  };

  fs.writeFileSync(failedManifestPath, JSON.stringify(next, null, 2), "utf8");
  removePdfUploadStage(uploadId);
  return next;
};

export const removePdfUploadStage = (uploadId) => {
  const target = getStageDir(uploadId);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
};

export const getPdfAbsolutePath = (fileName) => {
  ensureDocumentProcessingStorage();
  const safeName = sanitizePdfFilename(fileName);
  const resolved = path.resolve(PDF_DIR, safeName);
  if (!resolved.startsWith(path.resolve(PDF_DIR))) {
    throw new Error("Invalid PDF path.");
  }
  return resolved;
};
