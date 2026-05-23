import YuktiGrievance from "../Models/yuktiGrievanceModel.js";
import { sendEmail } from "../src/utils/emailService.js";
import { logControllerError, respondError, respondOk } from "../services/controllerResponses.js";
import { createWebhookSignatureHeaders } from "../services/webhookSecurity.js";
import { retrieveKnowledgeContext } from "../services/knowledgeBaseService.js";
import { resolveYuktiClarificationState } from "../services/yuktiClarificationService.js";
import { appConfig } from "../Config/runtimeConfig.js";

const YUKTI_WEBHOOK_URL = appConfig.urls.yuktiWebhookUrl;
const YUKTI_TIMEOUT_MS = Math.max(Number(process.env.YUKTI_TIMEOUT_MS || 15000), 1000);

const TAX_KEYWORD_PATTERN =
  /\b(tax|taxes|taxation|nri|india|indian|dtaa|itr|tds|gst|income tax|capital gains|withholding|residential status|residency|trc|form 10f|pan|nre|nro|fema|remittance)\b/i;

const sanitizeText = (value) => (typeof value === "string" ? value.trim() : "");
const DEFAULT_ADMIN_EMAIL = appConfig.branding.adminEmail;

const isValidOptionalField = (value, maxLength = 80) =>
  !value || (typeof value === "string" && value.trim().length <= maxLength);

const isTaxQuestion = (question) => TAX_KEYWORD_PATTERN.test(String(question || ""));
const isValidEmail = (email) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(String(email || ""));
const getAdminEmail = () => sanitizeText(process.env.ADMIN_EMAIL) || DEFAULT_ADMIN_EMAIL;
const buildGrievanceSubject = (message) => {
  const compact = sanitizeText(message).replace(/\s+/g, " ");
  if (!compact) return "Yukti support grievance";
  return compact.length <= 72 ? compact : `${compact.slice(0, 69)}...`;
};

const parseWebhookResponse = async (response) => {
  const rawText = await response.text();

  if (!rawText || !rawText.trim()) {
    return { data: null, rawText: "" };
  }

  try {
    return {
      data: JSON.parse(rawText),
      rawText,
    };
  } catch {
    return {
      data: null,
      rawText: rawText.trim(),
    };
  }
};

const extractAnswer = (payload, rawText = "") => {
  if (typeof payload === "string" && payload.trim()) return payload.trim();

  const directCandidates = [
    payload?.answer,
    payload?.reply,
    payload?.message,
    payload?.text,
    payload?.output,
    payload?.response,
    payload?.data?.answer,
    payload?.data?.reply,
    payload?.result?.answer,
    payload?.result?.reply,
  ];

  const directMatch = directCandidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  if (directMatch) return directMatch.trim();

  if (Array.isArray(payload)) {
    const textMatch = payload
      .map((item) => extractAnswer(item))
      .find((value) => typeof value === "string" && value.trim());
    if (textMatch) return textMatch.trim();
  }

  if (rawText.trim()) return rawText.trim();
  return "";
};

export const askYukti = async (req, res) => {
  const question = sanitizeText(req.body?.question);
  const country = sanitizeText(req.body?.country);
  const taxYear = sanitizeText(req.body?.taxYear);
  const residentialStatus = sanitizeText(req.body?.residentialStatus);
  const requestedUserId = sanitizeText(req.body?.userId);
  const userId = requestedUserId || req.user?._id?.toString?.() || "";

  if (!question) {
    return respondError(res, 400, "Question is required.", { ok: false, agent: "Yukti", answer: "Question is required." });
  }

  if (question.length < 3 || question.length > 1500) {
    return respondError(res, 400, "Question must be between 3 and 1500 characters.", {
      ok: false,
      agent: "Yukti",
      answer: "Question must be between 3 and 1500 characters.",
    });
  }

  if (
    !isValidOptionalField(country, 80) ||
    !isValidOptionalField(taxYear, 24) ||
    !isValidOptionalField(residentialStatus, 80) ||
    !isValidOptionalField(userId, 120)
  ) {
    return respondError(res, 400, "One or more optional fields are invalid.", {
      ok: false,
      agent: "Yukti",
      answer: "One or more optional fields are invalid.",
    });
  }

  if (!isTaxQuestion(question)) {
    return respondError(res, 400, "Yukti answers only tax-related questions, especially Indian tax and NRI tax.", {
      ok: false,
      agent: "Yukti",
      answer: "Yukti answers only tax-related questions, especially Indian tax and NRI tax.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YUKTI_TIMEOUT_MS);

  try {
    const clarificationState = await resolveYuktiClarificationState({
      question,
      payload: {
        currentCountry: req.body?.currentCountry || country,
        relevantCountry: req.body?.relevantCountry || req.body?.countryRelevantToQuery,
        residencyStatus: req.body?.residencyStatus || residentialStatus,
        financialYear: req.body?.financialYear || taxYear,
        incomeType: req.body?.incomeType,
        maritalStatus: req.body?.maritalStatus,
        dependents: req.body?.dependents ?? req.body?.numberOfChildren ?? req.body?.children,
      },
      userId,
      sessionId: sanitizeText(req.body?.sessionId),
    });

    req.logger?.info?.(
      {
        workflow: "yukti_clarification",
        route: clarificationState.routing.route,
        category: clarificationState.category || clarificationState.routing.route,
        confidence: clarificationState.routing.confidence,
        missingFields: clarificationState.missingFields,
      },
      "resolved yukti clarification state"
    );

    if (clarificationState.shouldClarify) {
      return respondOk(res, {
        ok: true,
        agent: "Yukti",
        needsClarification: true,
        answer: clarificationState.followUpQuestion,
        missingFields: clarificationState.missingFields,
        sessionContext: clarificationState.context,
        routing: clarificationState.routing,
        sources: [],
      });
    }

    const resolvedQuestion = sanitizeText(clarificationState.resolvedQuestion || question) || question;

    req.logger?.info?.(
      {
        workflow: "yukti_retrieval",
        route: clarificationState.routing.route,
        category: clarificationState.category || clarificationState.routing.route,
        contextFields: Object.keys(clarificationState.context || {}),
      },
      "triggering yukti retrieval"
    );

    const knowledge = await retrieveKnowledgeContext(resolvedQuestion, {
      sourceTypes: ["dtaa_pdf", "tax_law", "fema_doc", "tds_rule", "capital_gains", "nri_compliance", "other_pdf"],
      context: clarificationState.context,
    }).catch(() => ({ context: "", sources: [], confidence: 0, insufficientContext: true }));

    const payload = {
      question: resolvedQuestion,
      latestUserMessage: question,
      ...(clarificationState.context.residenceCountry
        ? { country: clarificationState.context.residenceCountry }
        : clarificationState.context.currentCountry
          ? { country: clarificationState.context.currentCountry }
          : country
            ? { country }
            : {}),
      ...(clarificationState.context.financialYear ? { taxYear: clarificationState.context.financialYear } : taxYear ? { taxYear } : {}),
      ...(clarificationState.context.residencyStatus
        ? { residentialStatus: clarificationState.context.residencyStatus }
        : residentialStatus
          ? { residentialStatus }
          : {}),
      ...(clarificationState.context.relevantCountry ? { relevantCountry: clarificationState.context.relevantCountry } : {}),
      ...(clarificationState.context.incomeType ? { incomeType: clarificationState.context.incomeType } : {}),
      ...(clarificationState.context.maritalStatus ? { maritalStatus: clarificationState.context.maritalStatus } : {}),
      ...(clarificationState.context.dependents !== null && clarificationState.context.dependents !== undefined
        ? { dependents: clarificationState.context.dependents }
        : {}),
      ...(userId ? { userId } : {}),
      ...(knowledge?.context ? { knowledgeContext: knowledge.context } : {}),
      ...(Array.isArray(knowledge?.sources) && knowledge.sources.length ? { knowledgeSources: knowledge.sources } : {}),
      knowledgeConfidence: Number(knowledge?.confidence || 0),
      knowledgeInsufficientContext: Boolean(knowledge?.insufficientContext),
      knowledgeInstructions:
        "Use retrieved knowledge context as the primary grounding source. Prefer quoted or paraphrased content from the provided sources, cite Source IDs where possible, and if the context is insufficient say you are unsure instead of inferring unsupported tax rules.",
      routing: clarificationState.routing,
    };
    const serializedPayload = JSON.stringify(payload);

    const webhookResponse = await fetch(YUKTI_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        ...createWebhookSignatureHeaders({
          payload: serializedPayload,
          secret: process.env.YUKTI_WEBHOOK_SIGNING_SECRET,
          source: "nritax-yukti",
        }),
      },
      body: serializedPayload,
      signal: controller.signal,
    });

    const webhookResult = await parseWebhookResponse(webhookResponse);
    const answer = extractAnswer(webhookResult.data, webhookResult.rawText);

    if (!webhookResponse.ok) {
      return respondError(res, 502, answer || `Yukti webhook failed with status ${webhookResponse.status}.`, {
        ok: false,
        agent: "Yukti",
        answer: answer || `Yukti webhook failed with status ${webhookResponse.status}.`,
      });
    }

    if (!answer) {
      return respondError(res, 502, "Yukti did not return a usable answer.", {
        ok: false,
        agent: "Yukti",
        answer: "Yukti did not return a usable answer.",
      });
    }

    return respondOk(res, {
      ok: true,
      agent: "Yukti",
      answer,
      needsClarification: false,
      sessionContext: clarificationState.context,
      routing: clarificationState.routing,
      sources: knowledge?.sources || [],
      retrieval: {
        confidence: Number(knowledge?.confidence || 0),
        insufficientContext: Boolean(knowledge?.insufficientContext),
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return respondError(res, 504, "Yukti request timed out. Please try again.", {
        ok: false,
        agent: "Yukti",
        answer: "Yukti request timed out. Please try again.",
      });
    }

    logControllerError("yukti.ask", error);
    return respondError(res, 500, "Unable to reach Yukti right now. Please try again.", {
      ok: false,
      agent: "Yukti",
      answer: "Unable to reach Yukti right now. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const submitYuktiGrievance = async (req, res) => {
  try {
    const userName = sanitizeText(req.user?.name);
    const userEmail = sanitizeText(req.user?.email).toLowerCase();
    const message = sanitizeText(req.body?.message || req.body?.grievance || req.body?.issue);
    const page = sanitizeText(req.body?.page);
    const source = sanitizeText(req.body?.source) || "Yukti Chat Widget";

    if (!userName || !userEmail) {
      return respondError(res, 401, "Please sign in again to submit a grievance through Yukti.", { success: false });
    }

    if (!message || message.length < 10) {
      return respondError(res, 400, "Please describe your grievance in a little more detail.", { success: false });
    }

    if (message.length > 3000) {
      return respondError(res, 400, "Grievance message is too long. Please keep it under 3000 characters.", { success: false });
    }

    if (!isValidEmail(userEmail)) {
      return respondError(res, 400, "Your account email is invalid. Please update your profile and try again.", { success: false });
    }

    const adminEmail = getAdminEmail();
    const grievance = await YuktiGrievance.create({
      userId: req.user?._id || null,
      name: userName,
      email: userEmail,
      subject: buildGrievanceSubject(message),
      message,
      source,
      page,
      notificationRecipient: adminEmail,
    });

    setImmediate(async () => {
      const emailErrors = [];
      const emailTasks = [
        sendEmail({
          to: userEmail,
          subject: `We received your Yukti support request (${grievance.ticketNumber})`,
          html: `
            <h2>Hello ${userName},</h2>
            <p>We received your support request from Yukti.</p>
            <p><strong>Ticket ID:</strong> ${grievance.ticketNumber}</p>
            <p><strong>Your message:</strong> ${message}</p>
            <p>Our team will review it and contact you using your registered email if needed.</p>
            <br/>
            <p>Regards,<br/>Billion Dollar Technologies Private Limited</p>
          `,
        }),
        sendEmail({
          to: adminEmail,
          subject: `New Yukti grievance: ${grievance.ticketNumber}`,
          html: `
            <h3>New Yukti grievance submitted</h3>
            <p><strong>Ticket ID:</strong> ${grievance.ticketNumber}</p>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Source:</strong> ${source}</p>
            <p><strong>Page:</strong> ${page || "Not provided"}</p>
            <p><strong>Message:</strong> ${message}</p>
          `,
        }),
      ];

      const [customerEmailResult, adminEmailResult] = await Promise.allSettled(emailTasks);

      if (customerEmailResult.status === "rejected") {
        emailErrors.push(`customer:${String(customerEmailResult.reason?.message || customerEmailResult.reason || "unknown")}`);
      }

      if (adminEmailResult.status === "rejected") {
        emailErrors.push(`admin:${String(adminEmailResult.reason?.message || adminEmailResult.reason || "unknown")}`);
      }

      try {
        grievance.notificationStatus = emailErrors.length === 0 ? "sent" : "failed";
        grievance.notifiedAt = emailErrors.length === 0 ? new Date() : null;
        grievance.notificationError = emailErrors.join(" | ");
        await grievance.save();
      } catch (error) {
        console.error("[yukti-grievance] notification status save failed", error);
      }
    });

    return respondOk(res, {
      success: true,
      message: "Your grievance has been submitted successfully.",
      ticketNumber: grievance.ticketNumber,
      grievanceId: grievance._id,
    });
  } catch (error) {
    logControllerError("yukti.grievance", error);
    return respondError(res, 500, "Unable to submit your grievance right now. Please try again.", { success: false });
  }
};
