import mongoose from "mongoose";

const asyncJobSchema = new mongoose.Schema(
  {
    queueName: {
      type: String,
      required: true,
      trim: true,
    },
    jobName: {
      type: String,
      required: true,
      trim: true,
    },
    jobId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    dedupeKey: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "active", "completed", "failed", "dead_lettered"],
      default: "queued",
      index: true,
    },
    attemptsMade: {
      type: Number,
      default: 0,
      min: 0,
    },
    payloadSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resultSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastError: {
      type: String,
      trim: true,
      default: "",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    deadLetteredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

asyncJobSchema.index({ queueName: 1, status: 1, createdAt: -1 });

const AsyncJob = mongoose.model("AsyncJob", asyncJobSchema);
export default AsyncJob;
