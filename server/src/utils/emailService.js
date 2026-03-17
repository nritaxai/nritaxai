import nodemailer from "nodemailer";

let cachedTransporter = null;

const RESEND_API_URL = "https://api.resend.com/emails";

const sanitizeEnv = (value) => String(value || "").trim();
const sanitizePassword = (value) => sanitizeEnv(value).replace(/\s+/g, "");

const getEmailProvider = () => {
  const explicitProvider = sanitizeEnv(process.env.EMAIL_PROVIDER).toLowerCase();
  if (explicitProvider) return explicitProvider;
  if (sanitizeEnv(process.env.RESEND_API_KEY)) return "resend";
  return "smtp";
};

const getEmailConfig = () => {
  const user = sanitizeEnv(process.env.EMAIL_USER);
  const pass = sanitizePassword(process.env.EMAIL_PASS);
  const service = sanitizeEnv(process.env.EMAIL_SERVICE);
  const host = sanitizeEnv(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 0) || undefined;
  const secure =
    String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true" ||
    port === 465;

  return { user, pass, service, host, port, secure };
};

const getResendConfig = () => {
  const apiKey = sanitizeEnv(process.env.RESEND_API_KEY);
  const from = sanitizeEnv(process.env.RESEND_FROM_EMAIL) || "NRITAX <onboarding@resend.dev>";

  if (!apiKey) {
    throw new Error("Missing required email env var: RESEND_API_KEY");
  }

  return { apiKey, from };
};

const assertSmtpEnv = (config) => {
  if (!config.user || !config.pass) {
    throw new Error("Missing required email env vars: EMAIL_USER, EMAIL_PASS");
  }
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
  assertSmtpEnv(config);
  cachedTransporter = buildTransporter(config);
  return cachedTransporter;
};

const sendViaResend = async ({ to, subject, html, fromOverride }) => {
  const config = getResendConfig();
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromOverride || config.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Resend request failed with status ${response.status}`);
  }

  return {
    messageId: body?.id || null,
    provider: "resend",
    raw: body,
  };
};

const sendViaSmtp = async ({ to, subject, html, fromOverride }) => {
  const config = getEmailConfig();
  assertSmtpEnv(config);

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

    throw error;
  }
};

export const sendEmail = async ({ to, subject, html, fromOverride }) => {
  try {
    if (getEmailProvider() === "resend") {
      return await sendViaResend({ to, subject, html, fromOverride });
    }

    return await sendViaSmtp({ to, subject, html, fromOverride });
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};
