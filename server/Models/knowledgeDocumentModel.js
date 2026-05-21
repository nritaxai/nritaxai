import mongoose from "mongoose";

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    fileHash: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["dtaa_pdf", "tax_law", "fema_doc", "tds_rule", "capital_gains", "nri_compliance", "other_pdf"],
      default: "other_pdf",
      index: true,
    },
    status: {
      type: String,
      enum: ["staged", "processing", "completed", "failed", "skipped_duplicate"],
      default: "staged",
      index: true,
    },
    pageCount: {
      type: Number,
      default: 0,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    sizeBytes: {
      type: Number,
      default: 0,
    },
    extractionMode: {
      type: String,
      trim: true,
      default: "native_text",
    },
    storagePath: {
      type: String,
      trim: true,
      default: "",
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: "",
    },
    policyTags: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastIngestedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

knowledgeDocumentSchema.index({ sourceType: 1, status: 1, updatedAt: -1 });

const KnowledgeDocument = mongoose.model("KnowledgeDocument", knowledgeDocumentSchema);
export default KnowledgeDocument;
