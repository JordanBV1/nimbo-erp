import nodemailer from "nodemailer";
import { logger } from "./logger.js";

export interface MailerConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export function getMailerConfig(): MailerConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@nimbo-erp.com",
    secure: process.env.SMTP_SECURE === "true",
  };
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const cfg = getMailerConfig();
  if (!cfg) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      socketOptions: { family: 4 },
    });
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const cfg = getMailerConfig();
  const t = getTransporter();
  if (!cfg || !t) {
    logger.warn({ to, subject }, "SMTP not configured — email not sent. Set SMTP_HOST/SMTP_USER/SMTP_PASS to enable.");
    return false;
  }
  try {
    await t.sendMail({ from: cfg.from, to, subject, html });
    logger.info({ to, subject }, "Email sent");
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "Email send failed");
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0A0A0B;border-radius:12px;">
      <h2 style="color:#fff;margin-bottom:16px;">Restablecer contraseña</h2>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color:#fff;">Nimbo ERP</strong>.</p>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">Este enlace es válido por <strong style="color:#fff;">1 hora</strong>. Si no solicitaste este cambio, puedes ignorar este correo.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}" style="background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">Restablecer contraseña</a>
      </div>
      <p style="color:#64748b;font-size:12px;">O copia y pega este enlace en tu navegador:<br/><span style="color:#3b82f6;word-break:break-all;">${resetUrl}</span></p>
    </div>
  `;
  return sendMail(to, "Restablecer contraseña — Nimbo ERP", html);
}

export async function sendSubscriptionReminderEmail(to: string, orgName: string, daysLeft: number, payUrl: string): Promise<boolean> {
  const when = daysLeft <= 0 ? "hoy" : `en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0A0A0B;border-radius:12px;">
      <h2 style="color:#fff;margin-bottom:16px;">Tu suscripción expira ${when}</h2>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">La suscripción de <strong style="color:#fff;">${orgName}</strong> en <strong style="color:#fff;">Nimbo ERP</strong> está por vencer.</p>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">Renueva antes del vencimiento para no interrumpir el acceso a tu sistema.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${payUrl}" style="background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">Renovar suscripción</a>
      </div>
      <p style="color:#64748b;font-size:12px;">Si ya realizaste el pago, ignora este correo.</p>
    </div>
  `;
  return sendMail(to, `Tu suscripción Nimbo ERP expira ${when}`, html);
}
