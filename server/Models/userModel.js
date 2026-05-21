import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter your name"],
      trim: true
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      required: [true, "Please enter your email"],
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      // required: [true, "Please enter a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
      // match: [
      //   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/,
      //   "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      // ],
    },
    googleId: {
      type: String,
    },
    appleId: {
      type: String,
    },
    linkedinId: {
      type: String,
    },
    profileImage: {
      type: String,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    countryOfResidence: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    countryCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    initialCountry: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    initialCountryName: {
      type: String,
      trim: true,
      default: "",
    },
    countryLocked: {
      type: Boolean,
      default: false,
    },
    countryLockedAt: {
      type: Date,
      default: null,
    },
    countryApprovalStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    countryChangeStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    countryChangeRequest: {
      requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CountryChangeRequest",
        default: null,
      },
      requestedCountry: {
        type: String,
        trim: true,
        default: "",
      },
      requestedCountryCode: {
        type: String,
        trim: true,
        uppercase: true,
        default: "",
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected", "cancelled"],
        default: "none",
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      decisionNotes: {
        type: String,
        trim: true,
        default: "",
      },
    },
    countryAuditLogs: [
      {
        action: {
          type: String,
          trim: true,
          required: true,
        },
        fromCountry: {
          type: String,
          trim: true,
          default: "",
        },
        fromCountryCode: {
          type: String,
          trim: true,
          uppercase: true,
          default: "",
        },
        toCountry: {
          type: String,
          trim: true,
          default: "",
        },
        toCountryCode: {
          type: String,
          trim: true,
          uppercase: true,
          default: "",
        },
        status: {
          type: String,
          trim: true,
          default: "info",
        },
        actor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        reason: {
          type: String,
          trim: true,
          default: "",
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    complianceProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    roles: {
      type: [String],
      default: ["end_user"],
    },
    preferredLanguage: {
      type: String,
      enum: ["english", "hindi", "tamil", "indonesian"],
      default: "english",
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [240, "Bio must be at most 240 characters"],
      default: "",
    },
    linkedinProfile: {
      type: String,
      trim: true,
      default: "",
    },
    provider: {
      type: String,
      enum: ["local", "google", "apple", "linkedin"],
      default: "local",
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
    welcomeEmailSentAt: {
      type: Date,
      default: null,
    },
    termsAccepted: {
      type: Boolean,
      default: false,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    policyVersion: {
      type: String,
      trim: true,
      default: "",
    },
    acceptedIp: {
      type: String,
      trim: true,
      default: "",
    },

    plan: {
      type: String,
      enum: ["starter", "professional", "enterprise"],
      default: "starter",
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "canceled"],
      default: "active",
    },
    subscriptionStartDate: {
      type: Date,
      default: null,
    },
    subscriptionEndDate: {
      type: Date,
      default: null,
    },
    chatUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    chatUsageMonth: {
      type: Date,
      default: Date.now,
    },
    cpaUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cpaUsageMonth: {
      type: Date,
      default: Date.now,
    },

    // ---------------- Subscription ----------------
    subscription: {
      plan: {
        type: String,
        enum: ["FREE", "PRO", "PREMIUM"],
        default: "FREE",
      },
      status: {
        type: String,
        enum: ["active", "inactive", "cancelled", "expired", "trial"],
        default: "inactive",
      },
      provider: {
        type: String,
        enum: ["razorpay", "promo"],
        default: "razorpay",
     },
      subscriptionId: {
        type: String,
        default: null,
      },

      currentPeriodStart: {
        type: Date,
        default: null,
      },

      currentPeriodEnd: {
        type: Date,
        default: null,
      },
    },

    // ---------------- Usage ----------------

    usage: {
      queriesUsed: {
        type: Number,
        default: 0,
      },

      lastReset: {
        type: Date,
        default: Date.now,
      },
    },

  },
  { timestamps: true }
);

// Hashing password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre("save", function () {
  if (this.isNew || !this.countryLocked || this.$locals?.allowCountryMutation) return;

  const countryChanged =
    this.isModified("country") ||
    this.isModified("countryOfResidence") ||
    this.isModified("countryCode") ||
    this.isModified("initialCountry") ||
    this.isModified("initialCountryName");

  if (countryChanged) {
    throw new Error("Locked signup country cannot be changed without admin approval.");
  }
});


// Comparing password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
}

const User = mongoose.model("User", userSchema);
export default User;
