import { sendEmail } from "../emailService.js";

const normalize = (value, fallback = "") => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
};

export const sendConsultationConfirmationEmail = async ({
  to,
  name,
  date,
  time,
  timezone,
  bookingId,
}) => {
  const safeName = normalize(name, "Customer");
  const safeDate = normalize(date, "To be confirmed");
  const safeTime = normalize(time, "To be confirmed");
  const safeTimezone = normalize(timezone, "Asia/Kolkata");
  const safeBookingId = normalize(String(bookingId || ""), "N/A");

  const info = await sendEmail({
    to,
    subject: "CPA Consultation Booking Confirmed",
    html: `
      <h2>Hello ${safeName},</h2>
      <p>Your CPA consultation has been successfully booked.</p>
      <p><strong>Booking ID:</strong> ${safeBookingId}</p>
      <p><strong>Date:</strong> ${safeDate}</p>
      <p><strong>Time:</strong> ${safeTime}</p>
      <p><strong>Timezone:</strong> ${safeTimezone}</p>
      <p>We will contact you shortly.</p>
      <br/>
      <p>Regards,<br/>NRITAX Team</p>
    `,
  });

  return { data: { id: info?.messageId || null }, error: null };
};

export const sendConsultationAdminNotificationEmail = async ({
  to,
  name,
  email,
  phone,
  date,
  time,
  timezone,
  bookingId,
  notes,
}) => {
  const info = await sendEmail({
    to,
    subject: "New CPA Consultation Booking",
    html: `
      <h3>New Booking Details</h3>
      <p><strong>Booking ID:</strong> ${normalize(String(bookingId || ""), "N/A")}</p>
      <p><strong>Name:</strong> ${normalize(name, "N/A")}</p>
      <p><strong>Email:</strong> ${normalize(email, "N/A")}</p>
      <p><strong>Phone:</strong> ${normalize(phone, "N/A")}</p>
      <p><strong>Date:</strong> ${normalize(date, "To be confirmed")}</p>
      <p><strong>Time:</strong> ${normalize(time, "To be confirmed")}</p>
      <p><strong>Timezone:</strong> ${normalize(timezone, "Asia/Kolkata")}</p>
      <p><strong>Notes:</strong> ${normalize(notes, "-")}</p>
    `,
  });

  return { data: { id: info?.messageId || null }, error: null };
};
