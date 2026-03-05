import mongoose from "mongoose";

const consultationRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    country: { type: String, required: true, trim: true, maxlength: 80 },
    service: { type: String, required: true, trim: true, maxlength: 80 },
    taxQuery: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: ["new", "contacted", "closed"], default: "new" },
    notificationStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    notificationRecipient: { type: String, trim: true, default: "" },
    notifiedAt: { type: Date, default: null },
    notificationError: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const ConsultationRequest = mongoose.model("ConsultationRequest", consultationRequestSchema);
export default ConsultationRequest;
