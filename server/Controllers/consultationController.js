import ConsultationRequest from "../Models/consultationRequestModel.js";
import { CONSULTATION_WEBHOOK_URL } from "../Config/consultation.js";
import { sendEmail } from "../src/utils/emailService.js";

const sanitize = (value) => (typeof value === "string" ? value.trim() : "");
const DEFAULT_ADMIN_EMAIL = "admin@nritax.ai";
const CONSULTATION_WEBHOOK_TIMEOUT_MS = Number(process.env.CONSULTATION_WEBHOOK_TIMEOUT_MS || 12000);

const isValidEmail = (email) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(String(email || ""));

const isValidPhone = (phone) => /^[\d+()\-\s]{7,20}$/.test(String(phone || ""));

const getAdminEmail = () => sanitize(process.env.ADMIN_EMAIL) || DEFAULT_ADMIN_EMAIL;

const parseWebhookResponse = async (response) => {
  const rawText = await response.text();

  if (!rawText || rawText.trim() === "") {
    return {
      data: null,
      message: "",
      rawText: "",
    };
  }

  try {
    const data = JSON.parse(rawText);
    return {
      data,
      message:
        typeof data?.message === "string"
          ? data.message
          : typeof data?.status === "string"
          ? data.status
          : "",
      rawText,
    };
  } catch {
    return {
      data: null,
      message: rawText.trim(),
      rawText,
    };
  }
};

const forwardConsultationToWebhook = async (payload) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONSULTATION_WEBHOOK_TIMEOUT_MS);

  try {
    console.info(
      `[consultation] Forwarding submission to webhook: ${CONSULTATION_WEBHOOK_URL}`
    );

    const webhookResponse = await fetch(CONSULTATION_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const webhookResult = await parseWebhookResponse(webhookResponse);

    if (!webhookResponse.ok) {
      throw new Error(
        webhookResult?.message ||
          `Consultation webhook failed with status ${webhookResponse.status}`
      );
    }

    return webhookResult;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Consultation booking timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const queueConsultationEmails = ({
  requestDoc,
  bookingId,
  adminEmail,
  customerEmail,
  name,
  phone,
  whatsapp,
  contactMethod,
  date,
  time,
  timezone,
  country,
  service,
  notes,
}) => {
  setImmediate(async () => {
    const emailErrors = [];

    const emailTasks = [
      sendEmail({
        to: customerEmail,
        subject: "CPA Consultation Booking Confirmed",
        html: `
          <h2>Hello ${name},</h2>
          <p>Your CPA consultation has been successfully booked.</p>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Timezone:</strong> ${timezone}</p>
          <p>We will contact you shortly.</p>
          <br/>
          <p>Regards,<br/>NRITAX Team</p>
        `,
      }),
      sendEmail({
        to: adminEmail,
        subject: "New CPA Consultation Booking",
        html: `
          <h3>New Booking Details</h3>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>WhatsApp:</strong> ${whatsapp || "Not provided"}</p>
          <p><strong>Preferred Contact Method:</strong> ${contactMethod || "Not provided"}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Timezone:</strong> ${timezone}</p>
          <p><strong>Country:</strong> ${country}</p>
          <p><strong>Service:</strong> ${service}</p>
          <p><strong>Notes:</strong> ${notes}</p>
        `,
      }),
    ];

    const [confirmationResult, adminResult] = await Promise.allSettled(emailTasks);

    if (confirmationResult.status === "rejected") {
      const message = String(confirmationResult.reason?.message || confirmationResult.reason || "unknown");
      console.error("Consultation confirmation email error:", message);
      emailErrors.push(`confirmation:${message}`);
    }

    if (adminResult.status === "rejected") {
      const message = String(adminResult.reason?.message || adminResult.reason || "unknown");
      console.error("Consultation admin email error:", message);
      emailErrors.push(`admin:${message}`);
    }

    try {
      requestDoc.notificationStatus = emailErrors.length === 0 ? "sent" : "failed";
      requestDoc.notifiedAt = emailErrors.length === 0 ? new Date() : null;
      requestDoc.notificationError = emailErrors.join(" | ");
      await requestDoc.save();
    } catch (error) {
      console.error("Consultation notification status save error:", error);
    }
  });
};

export const submitConsultationRequest = async (req, res) => {
  try {
    const name = sanitize(req.body?.name);
    const email = sanitize(req.body?.email).toLowerCase();
    const phone = sanitize(req.body?.phone);
    const whatsapp = sanitize(req.body?.whatsapp);
    const contactMethod = sanitize(req.body?.contactMethod);
    const country = sanitize(req.body?.country);
    const preferredDate = sanitize(req.body?.preferredDate || req.body?.date);
    const preferredTime = sanitize(req.body?.preferredTime || req.body?.time);
    const timeZone = sanitize(req.body?.timeZone);
    const service = sanitize(req.body?.service);
    const queryDetails = sanitize(req.body?.queryDetails);
    const source = sanitize(req.body?.source) || "Website Consultation Form";
    const submittedAt = sanitize(req.body?.submittedAt) || new Date().toISOString();

    const date = preferredDate || "To be confirmed";
    const time = preferredTime || "To be confirmed";
    const timezone = timeZone || "Asia/Kolkata";
    const notes = queryDetails;

    if (!name || !email || !phone || !country || !service || !queryDetails) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number.",
      });
    }

    const adminEmail = getAdminEmail();

    const requestDoc = await ConsultationRequest.create({
      name,
      email,
      phone,
      whatsapp,
      contactMethod,
      country,
      service,
      preferredDate,
      preferredTime,
      taxQuery: queryDetails,
      notificationRecipient: adminEmail,
    });

    const webhookPayload = {
      name: name || "",
      email: email || "",
      phone: phone || "",
      whatsapp: whatsapp || "",
      contactMethod: contactMethod || "",
      country: country || "",
      date: preferredDate || "",
      time: preferredTime || "",
      preferredDate: preferredDate || "",
      preferredTime: preferredTime || "",
      timeZone: timeZone || "",
      service: service || "",
      queryDetails: queryDetails || "",
      source,
      submittedAt,
    };

    let webhookResult = null;

    try {
      webhookResult = await forwardConsultationToWebhook(webhookPayload);
    } catch (error) {
      console.error("Consultation webhook proxy error:", error);
      requestDoc.notificationStatus = "failed";
      requestDoc.notificationError = `webhook:${String(
        error?.message || error || "unknown"
      )}`;
      await requestDoc.save();

      return res.status(502).json({
        success: false,
        message: error?.message || "Failed to submit consultation request.",
      });
    }

    const bookingId = String(requestDoc._id);

    queueConsultationEmails({
      requestDoc,
      bookingId,
      adminEmail,
      customerEmail: email,
      name,
      phone,
      whatsapp,
      contactMethod,
      date,
      time,
      timezone,
      country,
      service,
      notes,
    });

    return res.status(200).json({
      success: true,
      message:
        webhookResult?.message || "Consultation request submitted successfully.",
      requestId: requestDoc._id,
      email: {
        queued: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit consultation request.",
      error: error.message,
    });
  }
};

export const sendConsultationTestEmail = async (req, res) => {
  try {
    const expectedSecret = sanitize(process.env.EMAIL_TEST_SECRET);
    if (!expectedSecret) {
      return res.status(503).json({
        success: false,
        message: "EMAIL_TEST_SECRET is not configured.",
      });
    }

    const providedSecret =
      sanitize(req.headers["x-email-test-secret"]) || sanitize(req.body?.secret);

    if (!providedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        message: "Invalid email test secret.",
      });
    }

    const to = sanitize(req.body?.to).toLowerCase();
    const name = sanitize(req.body?.name) || "Test User";

    if (!isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid recipient email.",
      });
    }

    const bookingId = `test-${Date.now()}`;

    const info = await sendEmail({
      to,
      subject: "CPA Consultation Booking Confirmed (Test)",
      html: `
        <h2>Hello ${name},</h2>
        <p>This is a test email from NRITAX consultation flow.</p>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Test consultation email sent successfully.",
      emailId: info?.messageId || null,
      bookingId,
    });
  } catch (error) {
    console.error("sendConsultationTestEmail error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send test consultation email.",
      error: error.message,
    });
  }
};
