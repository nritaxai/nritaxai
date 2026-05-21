import mongoose from "mongoose";

const countryChangeRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    currentCountryCode: {
      type: String,
      trim: true,
      required: true,
    },
    requestedCountryCode: {
      type: String,
      trim: true,
      required: true,
    },
    currentCountryName: {
      type: String,
      trim: true,
      default: "",
    },
    requestedCountryName: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    decisionNotes: {
      type: String,
      trim: true,
      default: "",
    },
    requestedBy: {
      type: String,
      trim: true,
      default: "user",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

countryChangeRequestSchema.index({ user: 1, status: 1, createdAt: -1 });

const CountryChangeRequest = mongoose.model("CountryChangeRequest", countryChangeRequestSchema);
export default CountryChangeRequest;
