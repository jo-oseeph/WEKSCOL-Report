import nodemailer from "nodemailer";

const isPlaceholder = (value) =>
  typeof value !== "string" ||
  !value.trim() ||
  value.includes("PASTE_YOUR_") ||
  value.includes("your-gmail-address");

const createEmailService = (emailConfig) => {
  const isConfigured = Boolean(
    emailConfig.host &&
      emailConfig.port &&
      !isPlaceholder(emailConfig.user) &&
      !isPlaceholder(emailConfig.password) &&
      !isPlaceholder(emailConfig.from),
  );
  const transporter = isConfigured
    ? nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        connectionTimeout: emailConfig.connectionTimeout,
        greetingTimeout: emailConfig.greetingTimeout,
        socketTimeout: emailConfig.socketTimeout,
        auth: { user: emailConfig.user, pass: emailConfig.password },
      })
    : null;

  return {
    isConfigured,
    async verifyConnection() {
      if (!transporter) {
        return { ok: false, reason: "Gmail SMTP configuration is incomplete." };
      }

      try {
        await transporter.verify();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          reason: error?.message || "Gmail SMTP verification failed.",
          code: error?.code,
        };
      }
    },
    async sendPasswordReset({ to, resetUrl }) {
      if (!transporter) {
        throw new Error("Gmail SMTP email configuration is incomplete.");
      }
      await transporter.sendMail({
        from: {
          name: emailConfig.fromName,
          address: emailConfig.from,
        },
        to,
        subject: "Reset your WESCOL Reports password",
        text: `A password reset was requested for your WESCOL Reports account. Use this link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>A password reset was requested for your WESCOL Reports account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
      });
    },
  };
};

export default createEmailService;