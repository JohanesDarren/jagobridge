import nodemailer, { type Transporter } from "nodemailer";
import { loadEnv } from "../core/env.js";
import { logger } from "../core/logger.js";

const env = loadEnv();

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const mailer = getTransporter();
  if (!mailer) {
    // Email is not configured (common in local development). Never fail the flow.
    logger.warn({ subject }, "email_skipped_smtp_not_configured");
    return;
  }
  try {
    await mailer.sendMail({ from: env.SMTP_FROM, to, subject, html });
    logger.info({ subject }, "email_sent");
  } catch (error) {
    logger.error({ err: error, subject }, "email_send_failed");
  }
}

export async function sendInvitationEmail(to: string, inviteUrl: string, expiresInHours: number): Promise<void> {
  await send(
    to,
    "You are invited to JagoBridge",
    `<p>You have been invited to JagoBridge.</p>
     <p><a href="${inviteUrl}">Accept your invitation</a></p>
     <p>This link is valid for ${expiresInHours} hours and can be used once.</p>`,
  );
}

export async function sendLockoutEmail(to: string, lockMinutes: number): Promise<void> {
  await send(
    to,
    "JagoBridge account temporarily locked",
    `<p>Your account was locked after too many failed sign-in attempts.</p>
     <p>It unlocks automatically after ${lockMinutes} minutes.</p>`,
  );
}

export async function sendPasswordResetEmail(to: string, temporaryPassword: string): Promise<void> {
  await send(
    to,
    "JagoBridge password reset",
    `<p>An administrator reset your password.</p>
     <p>Temporary password: <strong>${temporaryPassword}</strong></p>
     <p>You must change it on next sign-in.</p>`,
  );
}
