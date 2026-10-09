import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/config';
import { logger } from '../config/logger';

let transporter: Transporter | null | undefined;

/** Email is optional: without SMTP_HOST the system works with in-app notifications only. */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const { host, port, user, pass } = config.email;
  transporter = host
    ? nodemailer.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined })
    : null;
  return transporter;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Fire-and-forget email. Never throws. */
export async function sendEmail(to: string | null | undefined, subject: string, message: string): Promise<void> {
  const t = getTransporter();
  if (!t || !to) return;
  try {
    await t.sendMail({
      from: config.email.from,
      to,
      subject: `[Saara Ketha Harvest Hub] ${subject}`,
      text: message,
      html: `<div style="font-family:Arial,sans-serif"><h3>${escapeHtml(subject)}</h3><p>${escapeHtml(message)}</p><hr/><small>Saara Ketha Harvest Hub – automated notification</small></div>`,
    });
  } catch (err: any) {
    logger.warn(`Email to ${to} failed: ${err?.message}`);
  }
}
