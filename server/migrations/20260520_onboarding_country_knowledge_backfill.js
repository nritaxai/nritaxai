import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../Config/db.js";
import User from "../Models/userModel.js";
import UserConsent from "../Models/userConsentModel.js";
import { buildCountryProfile, normalizeCountryCode, resolveCountryRule } from "../services/countryPolicyService.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const users = await User.find({});
  let updatedUsers = 0;

  for (const user of users) {
    let changed = false;
    if (user.termsAccepted === undefined) {
      user.termsAccepted = false;
      changed = true;
    }
    if (user.acceptedAt === undefined) {
      user.acceptedAt = null;
      changed = true;
    }
    if (user.policyVersion === undefined) {
      user.policyVersion = "";
      changed = true;
    }
    if (user.countryLocked === undefined) {
      user.countryLocked = false;
      changed = true;
    }
    if (user.countryChangeStatus === undefined) {
      user.countryChangeStatus = "none";
      changed = true;
    }

    const inferredCountryCode = normalizeCountryCode(user.countryCode || user.countryOfResidence || "");
    if (!user.countryCode && inferredCountryCode) {
      user.countryCode = inferredCountryCode;
      user.countryOfResidence = resolveCountryRule(inferredCountryCode).name;
      user.complianceProfile = buildCountryProfile(inferredCountryCode);
      changed = true;
    } else if (!user.complianceProfile || Object.keys(user.complianceProfile || {}).length === 0) {
      user.complianceProfile = buildCountryProfile(inferredCountryCode || "IN");
      changed = true;
    }

    if (changed) {
      await user.save();
      updatedUsers += 1;
    }

    await UserConsent.findOneAndUpdate(
      { user: user._id },
      {
        $setOnInsert: {
          marketingEmails: false,
          productUpdates: true,
          analyticsTracking: true,
          consultationDataProcessing: true,
        },
        $set: {
          termsAcceptedAt: user.termsAccepted ? user.acceptedAt || null : null,
          consentVersion: user.policyVersion || "2026-05-20",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(JSON.stringify({ success: true, updatedUsers, totalUsers: users.length }, null, 2));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
