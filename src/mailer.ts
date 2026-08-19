import nodemailer from "nodemailer";
import { logger } from "./logger.js";

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface MailerConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export interface GmailApiConfig {
  user: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

export function getEmailJsConfig(): EmailJsConfig | null {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  if (!serviceId || !templateId || !publicKey) return null;
  return { serviceId, templateId, publicKey };
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

export function getGmailApiConfig(): GmailApiConfig | null {
  const user = process.env.GMAIL_USER;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!user || !clientId || !clientSecret || !refreshToken) return null;
  return { user, clientId, clientSecret, refreshToken };
}

export type MailMethod = "gmail-api" | "emailjs" | "smtp" | "none";

export function getMailMethod(): MailMethod {
  if (getGmailApiConfig()) return "gmail-api";
  if (getEmailJsConfig()) return "emailjs";
  if (getMailerConfig()) return "smtp";
  return "none";
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export async function getGmailAccessToken(cfg: GmailApiConfig): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data: any = await res.json();
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedAccessToken.token;
}

function buildMime(from: string, to: string, subject: string, html: string): string {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    html,
  ].join("\r\n");
}

export async function sendGmailApiMail(cfg: GmailApiConfig, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const token = await getGmailAccessToken(cfg);
    const mime = buildMime(cfg.user, to, subject, html);
    const raw = Buffer.from(mime, "utf8").toString("base64url");
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const detail = await res.text();
      logger.error({ to, subject, status: res.status, detail }, "Gmail API send failed");
      return false;
    }
    logger.info({ to, subject }, "Email sent via Gmail API");
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "Gmail API send error");
    return false;
  }
}

export async function sendEmailJsMail(cfg: EmailJsConfig, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: { to_email: to, subject, message: html },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      logger.error({ to, subject, status: res.status, detail }, "EmailJS send failed");
      return false;
    }
    logger.info({ to, subject }, "Email sent via EmailJS");
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "EmailJS send error");
    return false;
  }
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
    } as any);
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const gmailCfg = getGmailApiConfig();
  if (gmailCfg) {
    return sendGmailApiMail(gmailCfg, to, subject, html);
  }
  const emailJsCfg = getEmailJsConfig();
  if (emailJsCfg) {
    return sendEmailJsMail(emailJsCfg, to, subject, html);
  }
  const cfg = getMailerConfig();
  const t = getTransporter();
  if (!cfg || !t) {
    logger.warn({ to, subject }, "Email transport not configured — email not sent. Set GMAIL_*, EMAILJS_* or SMTP_* env vars to enable.");
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

export async function probeMail(): Promise<{
  method: MailMethod;
  configured: boolean;
  ok: boolean;
  error?: string;
  code?: string | null;
}> {
  const gmailCfg = getGmailApiConfig();
  if (gmailCfg) {
    try {
      await getGmailAccessToken(gmailCfg);
      return { method: "gmail-api", configured: true, ok: true };
    } catch (e: any) {
      return { method: "gmail-api", configured: true, ok: false, error: e?.message || String(e) };
    }
  }
  const emailJsCfg = getEmailJsConfig();
  if (emailJsCfg) {
    return { method: "emailjs", configured: true, ok: true };
  }
  const cfg = getMailerConfig();
  if (!cfg) {
    return { method: "none", configured: false, ok: false, error: "No hay GMAIL_*, EMAILJS_* ni SMTP_* configurado" };
  }
  try {
    const t = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      socketOptions: { family: 4 },
    } as any);
    await t.verify();
    return { method: "smtp", configured: true, ok: true };
  } catch (e: any) {
    return { method: "smtp", configured: true, ok: false, error: e?.message || String(e), code: e?.code || null };
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const safeUrl = escapeHtml(resetUrl);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0A0A0B;border-radius:12px;">
      <h2 style="color:#fff;margin-bottom:16px;">Restablecer contraseña</h2>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color:#fff;">Nimbo ERP</strong>.</p>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">Este enlace es válido por <strong style="color:#fff;">1 hora</strong>. Si no solicitaste este cambio, puedes ignorar este correo.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${safeUrl}" style="background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">Restablecer contraseña</a>
      </div>
      <p style="color:#64748b;font-size:12px;">O copia y pega este enlace en tu navegador:<br/><span style="color:#3b82f6;word-break:break-all;">${safeUrl}</span></p>
    </div>
  `;
  return sendMail(to, "Restablecer contraseña — Nimbo ERP", html);
}

export async function sendSubscriptionReminderEmail(to: string, orgName: string, daysLeft: number, payUrl: string): Promise<boolean> {
  const when = daysLeft <= 0 ? "hoy" : `en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`;
  const safeOrg = escapeHtml(orgName);
  const safeUrl = escapeHtml(payUrl);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0A0A0B;border-radius:12px;">
      <h2 style="color:#fff;margin-bottom:16px;">Tu suscripción expira ${when}</h2>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">La suscripción de <strong style="color:#fff;">${safeOrg}</strong> en <strong style="color:#fff;">Nimbo ERP</strong> está por vencer.</p>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">Renueva antes del vencimiento para no interrumpir el acceso a tu sistema.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${safeUrl}" style="background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">Renovar suscripción</a>
      </div>
      <p style="color:#64748b;font-size:12px;">Si ya realizaste el pago, ignora este correo.</p>
    </div>
  `;
  return sendMail(to, `Tu suscripción Nimbo ERP expira ${when}`, html);
}
