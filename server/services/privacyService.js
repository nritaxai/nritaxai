import crypto from "crypto";
import ChatHistory from "../Models/chatHistoryModel.js";
import ConsultationRequest from "../Models/consultationRequestModel.js";
import PrivacyRequest from "../Models/privacyRequestModel.js";
import UserConsent from "../Models/userConsentModel.js";
import User from "../Models/userModel.js";
import YuktiGrievance from "../Models/yuktiGrievanceModel.js";
import { buildDeletedUserEmail, buildDeletionSummary, hashValue } from "./dataProtection.js";
import { writeSecurityAuditLog } from "./securityAudit.js";

export const getOrCreateUserConsent = async (userId) => {
  if (!userId) return null;
  const existing = await UserConsent.findOne({ user: userId });
  if (existing) return existing;
  const user = await User.findById(userId).select("termsAccepted acceptedAt policyVersion");
  return UserConsent.create({
    user: userId,
    termsAcceptedAt: user?.termsAccepted ? user?.acceptedAt || new Date() : null,
    privacyPolicyAcceptedAt: null,
    consentVersion: user?.policyVersion || "2026-05",
  });
};

export const updateUserConsent = async ({ userId, body = {}, source = "web", req = null } = {}) => {
  const patch = {
    marketingEmails: Boolean(body.marketingEmails),
    productUpdates: body.productUpdates !== undefined ? Boolean(body.productUpdates) : true,
    analyticsTracking: body.analyticsTracking !== undefined ? Boolean(body.analyticsTracking) : true,
    consultationDataProcessing:
      body.consultationDataProcessing !== undefined ? Boolean(body.consultationDataProcessing) : true,
    consentSource: String(source || "web"),
  };

  if (body.acceptTerms) patch.termsAcceptedAt = new Date();
  if (body.acceptPrivacyPolicy) patch.privacyPolicyAcceptedAt = new Date();

  const consent = await UserConsent.findOneAndUpdate(
    { user: userId },
    { $set: patch, $setOnInsert: { consentVersion: "2026-05" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await writeSecurityAuditLog({
    req,
    action: "privacy.consent.updated",
    category: "privacy",
    status: "success",
    severity: "low",
    message: "User consent preferences updated.",
    metadata: {
      userId: String(userId),
      consentSource: patch.consentSource,
      analyticsTracking: patch.analyticsTracking,
      marketingEmails: patch.marketingEmails,
    },
  });

  return consent;
};

export const createPrivacyRequest = async ({ user, type = "delete_account", details = {} }) => {
  const requestId = `prv_${crypto.randomBytes(8).toString("hex")}`;
  return PrivacyRequest.create({
    user: user?._id || null,
    type,
    requestId,
    emailHash: hashValue(user?.email || ""),
    details,
  });
};

export const anonymizeUserFootprint = async ({ user, req = null }) => {
  if (!user?._id) return null;

  const deletionSummary = buildDeletionSummary(user);
  const deletedEmail = buildDeletedUserEmail(user._id);

  await Promise.all([
    ChatHistory.deleteMany({ user: user._id }),
    UserConsent.deleteOne({ user: user._id }),
    ConsultationRequest.updateMany(
      { email: user.email },
      {
        $set: {
          name: "Deleted User",
          email: deletedEmail,
          phone: "",
          whatsapp: "",
          taxQuery: "[deleted_by_user_request]",
          notificationError: "",
        },
      }
    ),
    YuktiGrievance.updateMany(
      {
        $or: [{ userId: user._id }, { email: user.email }],
      },
      {
        $set: {
          userId: null,
          name: "Deleted User",
          email: deletedEmail,
          message: "[deleted_by_user_request]",
        },
      }
    ),
  ]);

  await writeSecurityAuditLog({
    req,
    actorUserId: user._id,
    actorEmail: user.email,
    action: "privacy.account.anonymized",
    category: "privacy",
    status: "success",
    severity: "medium",
    message: "User-linked PII anonymized prior to account deletion.",
    metadata: deletionSummary,
  });

  return deletionSummary;
};

export const deleteUserAccountWithPrivacyControls = async ({ userId, req = null } = {}) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const privacyRequest = await createPrivacyRequest({
    user,
    type: "delete_account",
    details: {
      initiatedBy: "self_service",
    },
  });

  await PrivacyRequest.updateOne({ _id: privacyRequest._id }, { $set: { status: "processing" } });
  const deletionSummary = await anonymizeUserFootprint({ user, req });
  await User.findByIdAndDelete(user._id);
  await PrivacyRequest.updateOne(
    { _id: privacyRequest._id },
    {
      $set: {
        status: "completed",
        processedAt: new Date(),
        details: {
          ...(privacyRequest.details || {}),
          deletionSummary,
        },
      },
    }
  );

  await writeSecurityAuditLog({
    req,
    actorUserId: user._id,
    actorEmail: user.email,
    action: "privacy.account.deleted",
    category: "privacy",
    status: "success",
    severity: "medium",
    message: "User account deleted through self-service workflow.",
    metadata: {
      requestId: privacyRequest.requestId,
    },
  });

  return privacyRequest;
};
