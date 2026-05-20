import env from "../config/env";
import transporter from "../config/mail";

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string
): Promise<void> {
  const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;
  const subject = "Reset your password";
  const text = `You requested a password reset. Use the link below within 30 minutes:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  const html = `
    <p>You requested a password reset.</p>
    <p><a href="${resetUrl}">Click here to reset your password</a> (link expires in 30 minutes).</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  // Dev fallback: no SMTP configured → log the link so the flow stays testable.
  if (!transporter) {
    console.log(`[mail:dev] password reset for ${to} -> ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}
