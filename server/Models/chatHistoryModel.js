import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "ai"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    taxRuleTimelines: {
      type: [
        new mongoose.Schema(
          {
            id: String,
            ruleName: String,
            helperText: String,
            periods: {
              type: [
                new mongoose.Schema(
                  {
                    label: String,
                    value: String,
                    rate: Number,
                    exemption: Number,
                    threshold: Number,
                    effectiveStartDate: String,
                    effectiveEndDate: String,
                    active: Boolean,
                  },
                  { _id: false }
                ),
              ],
              default: [],
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const chatHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    language: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      default: "english",
    },
    knowledgeSource: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      default: "dtaa",
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

chatHistorySchema.index({ user: 1, language: 1, knowledgeSource: 1 }, { unique: true });

const ChatHistory = mongoose.model("ChatHistory", chatHistorySchema);
export default ChatHistory;

