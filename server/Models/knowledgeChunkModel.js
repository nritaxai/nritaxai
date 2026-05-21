import mongoose from "mongoose";

const knowledgeChunkSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeDocument",
      required: true,
      index: true,
    },
    documentHash: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    chunkId: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true,
    },
    fileName: {
      type: String,
      trim: true,
      required: true,
    },
    page: {
      type: Number,
      default: 0,
    },
    chunkIndex: {
      type: Number,
      default: 0,
    },
    sourceType: {
      type: String,
      trim: true,
      default: "other_pdf",
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

knowledgeChunkSchema.index({ document: 1, page: 1, chunkIndex: 1 });
knowledgeChunkSchema.index({ sourceType: 1, updatedAt: -1 });

const KnowledgeChunk = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
export default KnowledgeChunk;
