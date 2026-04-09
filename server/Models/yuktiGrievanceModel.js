import mongoose from "mongoose";

const generateTicketNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `YUK-${timestamp}-${random}`;
};

const yuktiGrievanceSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      default: generateTicketNumber,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    source: { type: String, trim: true, maxlength: 120, default: "Yukti Chat" },
    page: { type: String, trim: true, maxlength: 200, default: "" },
    status: {
      type: String,
      enum: ["new", "in_progress", "resolved", "closed"],
      default: "new",
    },
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

const YuktiGrievance = mongoose.model("YuktiGrievance", yuktiGrievanceSchema);
export default YuktiGrievance;
