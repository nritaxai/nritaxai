import nodemailer from "nodemailer";

let cachedTransporter = null;

const sanitizeEnv = (value) => String(value || "").trim();
const sanitizePassword = (value) => sanitizeEnv(value).replace(/\s+/g, "");

const getEmailConfig = () => {
  const user = sanitizeEnv(process.env.EMAIL_USER);
  const pass = sanitizePassword(process.env.EMAIL_PASS);
  const service = sanitizeEnv(process.env.EMAIL_SERVICE);
  const host = sanitizeEnv(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 0) || undefined;
  const secure =
    String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true" ||
    port === 465;

  if (!user || !pass) {
    throw new Error("Missing required email env vars: EMAIL_USER, EMAIL_PASS");
  }

  return { user, pass, service, host, port, secure };
};

const buildTransporter = (config, passOverride) => {
  const auth = {
    user: config.user,
    pass: passOverride || config.pass,
  };

  if (config.host) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port || 587,
      secure: config.secure,
      auth,
    });
  }

  return nodemailer.createTransport({
    service: config.service || "gmail",
    auth,
  });
};

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const config = getEmailConfig();
  cachedTransporter = buildTransporter(config);
  return cachedTransporter;
};

export const sendEmail = async ({ to, subject, html, fromOverride }) => {
  const config = getEmailConfig();

  try {
    const transporter = getTransporter();
    return await transporter.sendMail({
      from: fromOverride || `"NRITAX" <${config.user}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    const rawPass = sanitizeEnv(process.env.EMAIL_PASS);
    const compactPass = sanitizePassword(process.env.EMAIL_PASS);
    const canRetryWithCompactedPass = rawPass && rawPass !== compactPass;

    if (canRetryWithCompactedPass) {
      try {
        const fallbackTransporter = buildTransporter(config, compactPass);
        const info = await fallbackTransporter.sendMail({
          from: fromOverride || `"NRITAX" <${config.user}>`,
          to,
          subject,
          html,
        });
        cachedTransporter = fallbackTransporter;
        return info;
      } catch (retryError) {
        console.error("Email sending retry failed:", retryError);
      }
    }

    console.error("Email sending failed:", error);
    throw error;
  }
};
