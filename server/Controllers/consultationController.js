import ConsultationRequest from "../Models/consultationRequestModel.js";
import { sendEmail } from "../src/utils/emailService.js";

const sanitize = (value) => (typeof value === "string" ? value.trim() : "");
const DEFAULT_ADMIN_EMAIL = "admin@nritax.ai";

const isValidEmail = (email) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(String(email || ""));

const isValidPhone = (phone) => /^[\d+()\-\s]{7,20}$/.test(String(phone || ""));

const getAdminEmail = () => sanitize(process.env.ADMIN_EMAIL) || DEFAULT_ADMIN_EMAIL;

export const submitConsultationRequest = async (req, res) => {
  try {
    const name = sanitize(req.body?.name);
    const email = sanitize(req.body?.email).toLowerCase();
    const phone = sanitize(req.body?.phone);
    const country = sanitize(req.body?.country);
    const service = sanitize(req.body?.service);
    const taxQuery = sanitize(req.body?.taxQuery);

    const date = sanitize(req.body?.date) || "To be confirmed";
    const time = sanitize(req.body?.time) || "To be confirmed";
    const timezone = sanitize(req.body?.timezone) || "Asia/Kolkata";
    const notes = sanitize(req.body?.notes) || taxQuery;

    if (!name || !email || !phone || !country || !service || !taxQuery) {
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
      country,
      service,
      taxQuery,
      notificationRecipient: adminEmail,
    });

    const bookingId = String(requestDoc._id);
    const emailErrors = [];
    let confirmationSent = false;
    let adminNotified = false;

    try {
      await sendEmail({
        to: email,
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
      });
      confirmationSent = true;
    } catch (error) {
      const message = String(error?.message || error || "unknown");
      console.error("Consultation confirmation email error:", message);
      emailErrors.push(`confirmation:${message}`);
    }

    try {
      await sendEmail({
        to: adminEmail,
        subject: "New CPA Consultation Booking",
        html: `
          <h3>New Booking Details</h3>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Timezone:</strong> ${timezone}</p>
          <p><strong>Country:</strong> ${country}</p>
          <p><strong>Service:</strong> ${service}</p>
          <p><strong>Notes:</strong> ${notes}</p>
        `,
      });
      adminNotified = true;
    } catch (error) {
      const message = String(error?.message || error || "unknown");
      console.error("Consultation admin email error:", message);
      emailErrors.push(`admin:${message}`);
    }

    if (emailErrors.length === 0) {
      requestDoc.notificationStatus = "sent";
      requestDoc.notifiedAt = new Date();
      requestDoc.notificationError = "";
    } else {
      requestDoc.notificationStatus = "failed";
      requestDoc.notificationError = emailErrors.join(" | ");
    }

    await requestDoc.save();

    return res.status(200).json({
      success: true,
      message: "Consultation request submitted successfully.",
      requestId: requestDoc._id,
      email: {
        confirmationSent,
        adminNotified,
      },
      warning:
        emailErrors.length > 0
          ? "Booking saved, but one or more emails could not be delivered. Our team will still contact you shortly."
          : undefined,
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
