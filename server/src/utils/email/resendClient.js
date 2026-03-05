import { sendEmail } from "../emailService.js";

// Compatibility shim: legacy imports may call this module.
// No Resend dependency is used.
export const getResendClient = () => ({
  emails: {
    send: async ({ to, subject, html, text, from }) => {
      const body = html || (text ? `<pre>${String(text)}</pre>` : "");
      const info = await sendEmail({ to, subject, html: body, fromOverride: from });
      return { data: { id: info?.messageId || null }, error: null };
    },
  },
});

export const getResendFromAddress = () =>
  process.env.EMAIL_USER ? `NRITAX <${process.env.EMAIL_USER}>` : "NRITAX <no-reply@nritax.ai>";
