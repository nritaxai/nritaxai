import mongoose from "mongoose";

const knowledgeIngestionLogSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeDocument",
      default: null,
      index: true,
    },
    fileName: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    fileHash: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    jobId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    stage: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["started", "completed", "failed", "skipped"],
      required: true,
      index: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

knowledgeIngestionLogSchema.index({ stage: 1, createdAt: -1 });

const KnowledgeIngestionLog = mongoose.model("KnowledgeIngestionLog", knowledgeIngestionLogSchema);
export default KnowledgeIngestionLog;
