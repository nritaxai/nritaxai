import nodemailer from "nodemailer";

const requiredEnv = ["EMAIL_USER", "EMAIL_PASS"];

const assertEmailEnv = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required email env vars: ${missing.join(", ")}`);
  }
};

const getTransporter = () => {
  assertEmailEnv();
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendEmail = async ({ to, subject, html, fromOverride }) => {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: fromOverride || `"NRITAX" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    return info;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};
