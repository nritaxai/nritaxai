import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

const loadServiceModule = async (storageDir) => {
  process.env.DOCUMENT_STORAGE_DIR = storageDir;
  const moduleUrl = `${pathToFileURL(path.resolve("services/documentProcessingService.js")).href}?t=${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
};

test("document processing service stages validated uploads on disk", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nritax-doc-test-"));
  const sourceFile = path.join(tempRoot, "sample-upload.pdf");
  fs.writeFileSync(sourceFile, Buffer.from("%PDF-1.4\nsample pdf body", "utf8"));

  const service = await loadServiceModule(path.join(tempRoot, "storage"));
  service.ensureDocumentProcessingStorage();

  const manifest = service.createPdfUploadManifest({
    file: {
      path: sourceFile,
      originalname: "../unsafe name.pdf",
      size: fs.statSync(sourceFile).size,
      mimetype: "application/pdf",
    },
    requestedBy: "user-1",
    requestId: "req-1",
  });

  assert.equal(manifest.safeName, "unsafe name.pdf");
  assert.equal(manifest.status, "staged");
  assert.equal(fs.existsSync(manifest.sourcePath), true);
  assert.equal(fs.existsSync(sourceFile), false);
});
