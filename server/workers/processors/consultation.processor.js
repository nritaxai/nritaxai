import ConsultationRequest from "../../Models/consultationRequestModel.js";
import { sendEmail } from "../../src/utils/emailService.js";

export const processConsultationNotifications = async (payload) => {
  const {
    requestId,
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
  } = payload;

  const requestDoc = await ConsultationRequest.findById(requestId);
  if (!requestDoc) {
    return { skipped: true, reason: "request_not_found" };
  }

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
    emailErrors.push(`confirmation:${String(confirmationResult.reason?.message || confirmationResult.reason || "unknown")}`);
  }
  if (adminResult.status === "rejected") {
    emailErrors.push(`admin:${String(adminResult.reason?.message || adminResult.reason || "unknown")}`);
  }

  requestDoc.notificationStatus = emailErrors.length === 0 ? "sent" : "failed";
  requestDoc.notifiedAt = emailErrors.length === 0 ? new Date() : null;
  requestDoc.notificationError = emailErrors.join(" | ");
  await requestDoc.save();

  return {
    sent: emailErrors.length === 0,
    errors: emailErrors,
  };
};
