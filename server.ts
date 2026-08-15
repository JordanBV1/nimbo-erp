import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import "express-async-errors";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { db, initializeDatabase } from "./src/db/db.js";
import { Role, BusinessType, Currency } from "./src/types.js";
import { logger, httpLogger } from "./src/logger.js";
import { scheduleBackup, createBackup } from "./src/db/backup.js";
import { sendPasswordResetEmail, sendMail, sendSubscriptionReminderEmail, getMailerConfig } from "./src/mailer.js";
import nodemailer from "nodemailer";

const PORT = parseInt(process.env.PORT || "3000", 10);
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "dev-secret-do-not-use-in-prod-" + Math.random().toString(36);
})();

if (process.env.NODE_ENV === "production" && !process.env.APP_URL) {
  throw new Error("APP_URL environment variable must be set in production");
}

const SALT_ROUNDS = 10;

interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  branchId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgId?: string;
      org?: any;
    }
  }
}

function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Token de autenticación requerido" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

function authorize(...roles: Role[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tienes permisos para esta acción" });
    }
    next();
  };
}

function resolveOrg(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  try {
    db.branches.findById(req.user.branchId).then((branch: any) => {
      if (!branch) {
        return res.status(404).json({ error: "Sucursal no encontrada" });
      }
      db.organizations.findById(branch.organizationId).then((org: any) => {
        if (!org) {
          return res.status(404).json({ error: "Organización no encontrada" });
        }
        req.org = org;
        req.orgId = org.id;
        next();
      }).catch((e: any) => {
        logger.error({ err: e }, "resolveOrg failed");
        return res.status(500).json({ error: "Error al resolver organización" });
      });
    }).catch((e: any) => {
      logger.error({ err: e }, "resolveOrg failed");
      return res.status(500).json({ error: "Error al resolver organización" });
    });
  } catch (e: any) {
    logger.error({ err: e }, "resolveOrg failed");
    return res.status(500).json({ error: "Error al resolver organización" });
  }
}

function requireSubscription(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.org) {
    return res.status(401).json({ error: "No autenticado" });
  }
  if (req.org.subscriptionStatus === "expired") {
    return res.status(402).json({ error: "Suscripción vencida. Renueva tu plan para continuar." });
  }
  if (req.org.subscriptionExpiresAt && new Date(req.org.subscriptionExpiresAt) < new Date()) {
    db.organizations.update(req.org.id, { subscriptionStatus: "expired" }).then(() => {
      res.status(402).json({ error: "Suscripción vencida. Renueva tu plan para continuar." });
    }).catch((e: any) => {
      logger.error({ err: e }, "requireSubscription failed");
      res.status(500).json({ error: "Error interno del servidor" });
    });
    return;
  }
  next();
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  authenticate(req, res, () => resolveOrg(req, res, next));
}

function authSub(req: express.Request, res: express.Response, next: express.NextFunction) {
  auth(req, res, () => requireSubscription(req, res, next));
}

function logAudit(userId: string, action: string, entity: string, entityId?: string, changes?: string) {
  try {
    db.auditLogs.create({ userId, action, entity, entityId, changes }).catch((e: any) => {
      logger.error({ err: e }, "Audit logging failed");
    });
  } catch (e: any) {
    logger.error({ err: e }, "Audit logging failed");
  }
}

function isBranchInOrg(branchId: string, orgId: string): Promise<boolean> {
  return db.branches.findById(branchId).then((branch: any) => {
    return !!branch && branch.organizationId === orgId;
  }).catch(() => false);
}

function isOrgMatch(orgId: string, req: express.Request): boolean {
  return orgId === req.orgId;
}

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

const registerSchema = z.object({
  orgName: z.string().min(1, "Nombre de organización requerido"),
  branchName: z.string().min(1, "Nombre de sucursal requerido"),
  userName: z.string().min(1, "Nombre de usuario requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  businessType: z.nativeEnum(BusinessType).optional(),
});

const branchSchema = z.object({
  name: z.string().min(1, "Nombre del local requerido"),
  address: z.string().optional(),
  businessType: z.nativeEnum(BusinessType).optional(),
  organizationId: z.string().min(1, "Organización requerida"),
});

const paymentSchema = z.object({
  orgId: z.string().min(1),
  platform: z.enum(["transfermovil", "enzona"]),
  phone: z.string().optional(),
  transactionId: z.string().min(1, "ID de transacción requerido"),
  amount: z.number().positive(),
  userId: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(1, "Nombre del producto requerido"),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unitOfMeasure: z.string().optional(),
  isService: z.boolean().optional(),
  categoryId: z.string().optional(),
  taxId: z.string().optional(),
  priceCUP: z.number().optional(),
  priceUSD: z.number().optional(),
  costCUP: z.number().optional(),
  costUSD: z.number().optional(),
  imageUrl: z.string().optional(),
  variants: z.array(z.any()).optional(),
  userId: z.string().optional(),
});

const saleSchema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().optional(),
    quantity: z.number().positive(),
    priceCUP: z.number().optional(),
    priceUSD: z.number().optional(),
    tax: z.number().optional(),
    discount: z.number().optional(),
  })).min(1, "Debe haber al menos un producto"),
  totalCUP: z.number().optional(),
  totalUSD: z.number().optional(),
  taxTotalCUP: z.number().optional(),
  taxTotalUSD: z.number().optional(),
  discount: z.number().optional(),
  grandTotalCUP: z.number().optional(),
  grandTotalUSD: z.number().optional(),
  paymentMethod: z.string().optional(),
  payments: z.array(z.any()).optional(),
  userId: z.string().optional(),
  isCredit: z.boolean().optional(),
  loyaltyPointsRedeemed: z.number().optional(),
});

export const app = express();

let appReady: Promise<express.Express> | null = null;

export function registerApp(): Promise<express.Express> {
  if (!appReady) {
    appReady = registerAppInternal();
  }
  return appReady;
}

async function registerAppInternal(): Promise<express.Express> {
  app.set("trust proxy", 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", ...(process.env.APP_URL ? [process.env.APP_URL] : [])],
        fontSrc: ["'self'", "data:"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: process.env.NODE_ENV === "production" ? (process.env.APP_URL || false) : true,
    credentials: true,
  }));
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use(httpLogger);

  // Rate limiting
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/auth", authLimiter);
  app.use("/api", apiLimiter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: "Error interno del servidor" });
  });

  try {
    await initializeDatabase();
  } catch (err) {
    logger.error({ err }, "Database initialization failed");
  }

  // Health check
  app.get("/api/health", async (_req, res) => {
    let dbOk = false;
    let dbError: string | null = null;
    try {
      dbOk = ((await db.organizations.findMany()).length >= 0);
    } catch (e: any) {
      dbError = e?.message || "unknown";
    }

    let disk = null;
    try {
      const dbFile = path.join(process.cwd(), "db-data", "nimbo.db");
      if (fs.existsSync(dbFile)) {
        const stat = fs.statSync(dbFile);
        disk = { dbBytes: stat.size, dbModifiedAt: stat.mtime.toISOString() };
      }
    } catch {}

    const mem = process.memoryUsage();

    return res.json({
      status: dbOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      node: process.version,
      database: { ok: dbOk, error: dbError },
      disk,
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
      },
    });
  });

  app.post("/api/smtp/debug", authenticate, authorize(Role.SUPER_ADMIN), async (_req, res) => {
    const cfg = getMailerConfig();
    if (!cfg) return res.json({ configured: false });
    const t = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      socketOptions: { family: 4 },
    });
    try {
      await t.verify();
      return res.json({ configured: true, verified: true });
    } catch (e: any) {
      return res.json({ configured: true, verified: false, error: e?.message || String(e), code: e?.code || null, response: e?.response || null });
    }
  });

  // --- Auth Routes ---
  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { email, password } = parsed.data;

    const user = await db.users.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    if (!user.password) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const branch = await db.branches.findById(user.branchId);
    const org = branch ? await db.organizations.findById(branch.organizationId) : null;

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    });

    logAudit(user.id, "LOGIN", "User", user.id);

    const { password: _pw, ...safeUser } = user;

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: safeUser,
      branch,
      organization: org,
      token,
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { orgName, branchName, userName, email, password, businessType } = parsed.data;

    const existing = await db.users.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "El correo electrónico ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const org = await db.organizations.create({ name: orgName });
    const branch = await db.branches.create({
      organizationId: org.id,
      name: branchName,
      address: "Dirección de registro",
      businessType: businessType || BusinessType.GENERAL,
    });
    const user = await db.users.create({
      name: userName,
      email,
      password: hashedPassword,
      role: Role.ADMIN,
      branchId: branch.id,
    });

    await db.warehouses.create({
      name: `Almacén Principal ${branchName}`,
      branchId: branch.id,
      address: "Almacén por defecto",
      organizationId: org.id,
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    });

    logAudit(user.id, "REGISTER", "User", user.id, `Created organization ${orgName} and branch ${branchName}`);

    const { password: _pw, ...safeUser } = user;

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: safeUser,
      branch,
      organization: org,
      token,
    });
  });

  app.post("/api/auth/logout", async (_req, res) => {
    res.clearCookie("token");
    return res.json({ success: true });
  });

  const forgotPasswordSchema = z.object({
    email: z.string().email("Email inválido"),
  });

  const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token requerido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { email } = parsed.data;
    const user = await db.users.findByEmail(email);

    // Always respond the same way to avoid user enumeration
    if (!user) {
      return res.json({ success: true, message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.passwordResetTokens.invalidateForUser(user.id);
    await db.passwordResetTokens.create({ userId: user.id, token, expiresAt, used: false });

    const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const sent = await sendPasswordResetEmail(user.email, resetUrl);
    if (!sent) {
      logger.warn({ resetUrl }, "Password reset link generated (SMTP not configured)");
    } else {
      logger.info({ userId: user.id }, "Password reset email sent");
    }

    return res.json({
      success: true,
      message: sent
        ? "Revisa tu correo para restablecer tu contraseña."
        : "Revisa tu correo. (Correo no enviado: SMTP no configurado en el servidor)",
    });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { token, password } = parsed.data;

    const user = await (await db.users.findMany()).find(async (u: any) => {
      const valid = await db.passwordResetTokens.findValid(u.id, token);
      return !!valid;
    });

    if (!user) {
      return res.status(400).json({ error: "Enlace inválido o expirado. Solicita uno nuevo." });
    }

    const valid = await db.passwordResetTokens.findValid(user.id, token);
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await db.users.update(user.id, { password: hashed });
    await db.passwordResetTokens.markUsed(valid.id);
    await db.passwordResetTokens.invalidateForUser(user.id);
    logAudit(user.id, "PASSWORD_RESET", "User", user.id);

    return res.json({ success: true, message: "Contraseña restablecida correctamente. Ya puedes iniciar sesión." });
  });

  app.get("/api/auth/me", authenticate, async (req, res) => {
    const user = await db.users.findById(req.user!.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const { password: _pw, ...safeUser } = user;
    return res.json(safeUser);
  });

  const updateProfileSchema = z.object({
    name: z.string().min(1, "El nombre no puede estar vacío").max(120).optional(),
    email: z.string().email("Email inválido").optional(),
    currentPassword: z.string().min(1, "Debes confirmar tu contraseña actual").optional(),
    newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres").optional(),
  });

  app.put("/api/users/me", authenticate, async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { name, email, currentPassword, newPassword } = parsed.data;

    const existing = await db.users.findById(req.user!.userId);
    if (!existing) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const sensitiveChange = email !== undefined || newPassword !== undefined;
    if (sensitiveChange) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Debes confirmar tu contraseña actual para cambiar el correo o la contraseña" });
      }
      const valid = await bcrypt.compare(currentPassword, existing.password);
      if (!valid) {
        return res.status(400).json({ error: "La contraseña actual es incorrecta" });
      }
    }

    if (email && email.trim().toLowerCase() !== existing.email.toLowerCase()) {
      const other = await db.users.findByEmail(email);
      if (other) {
        return res.status(400).json({ error: "El nuevo correo ya está en uso por otro usuario" });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (newPassword) updateData.password = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const updatedUser = await db.users.update(existing.id, updateData);
    logAudit(req.user!.userId, "UPDATE_PROFILE", "User", existing.id, `Perfil actualizado por el propio usuario`);
    const { password: _pw, ...safeUser } = updatedUser;
    return res.json({ success: true, user: safeUser });
  });

  app.get("/api/auth/organization", authenticate, async (req, res) => {
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId es requerido" });
    }
    const org = await db.organizations.findById(orgId as string);
    if (!org) {
      return res.status(404).json({ error: "Organización no encontrada" });
    }
    const orgBranchIds = new Set((await db.branches.findMany()).filter((b: any) => b.organizationId === org.id).map((b: any) => b.id));
    if (!orgBranchIds.has(req.user!.branchId)) {
      return res.status(403).json({ error: "No tienes acceso a esta organización" });
    }
    return res.json(org);
  });

  app.get("/api/branches", authenticate, async (req, res) => {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId es requerido" });
    const orgBranchIds = new Set((await db.branches.findMany()).filter((b: any) => b.organizationId === orgId).map((b: any) => b.id));
    if (!orgBranchIds.has(req.user!.branchId)) {
      return res.status(403).json({ error: "No tienes acceso a esta organización" });
    }
    const all = await db.branches.findMany();
    const filtered = all.filter((b: any) => b.organizationId === orgId);
    return res.json(filtered);
  });

  app.post("/api/branches", authenticate, async (req, res) => {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { name, address, businessType, organizationId } = parsed.data;

    const org = await db.organizations.findById(organizationId);
    if (!org) {
      return res.status(404).json({ error: "Organización no encontrada" });
    }
    const orgBranchIds = new Set((await db.branches.findMany()).filter((b: any) => b.organizationId === org.id).map((b: any) => b.id));
    if (!orgBranchIds.has(req.user!.branchId)) {
      return res.status(403).json({ error: "No tienes acceso a esta organización" });
    }

    const branch = await db.branches.create({
      organizationId: org.id,
      name,
      address: address || "",
      businessType: businessType || BusinessType.GENERAL,
    });

    await db.warehouses.create({
      name: `Almacén Principal ${name}`,
      branchId: branch.id,
      address: address || "Almacén por defecto",
      organizationId: org.id,
    });

    logAudit(req.user!.userId, "CREATE", "Branch", branch.id, `Created branch ${name}`);

    const branchCount = (await db.branches.findMany()).filter((b: any) => b.organizationId === org.id).length;
    const basePrice = Number(await db.systemSettings.getValue("subscription_base_price", "5000"));
    const perBranchPrice = Number(await db.systemSettings.getValue("subscription_per_branch_price", "1000"));
    const monthlyFee = basePrice + Math.max(0, branchCount - 1) * perBranchPrice;

    return res.status(201).json({ success: true, branch, branchCount, monthlyFee });
  });

  // --- Subscription Routes ---

  app.get("/api/subscription/payments", authenticate, async (req, res) => {
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId es requerido" });
    }
    try {
      const allPayments = await db.subscriptionPayments.findMany();
      const orgPayments = allPayments.filter(p => p.organizationId === orgId);
      orgPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return res.json(orgPayments);
    } catch (e) {
      logger.error({ err: e }, "Failed to fetch subscription payments");
      return res.status(500).json({ error: "Fallo al obtener el historial de pagos" });
    }
  });

  // --- Public (no auth) pricing ---

  app.get("/api/public/pricing", async (_req, res) => {
    return res.json({
      basePrice: Number(await db.systemSettings.getValue("subscription_base_price", "5000")),
      perBranchPrice: Number(await db.systemSettings.getValue("subscription_per_branch_price", "1000")),
      currency: "CUP",
      businessName: await db.systemSettings.getValue("business_name", "Nimbo ERP"),
      transfermovilPhone: await db.systemSettings.getValue("transfermovil_phone", "+53 51234567"),
    });
  });

  app.get("/api/subscription/pricing", authenticate, async (req, res) => {    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId es requerido" });
    }
    const org = await db.organizations.findById(orgId as string);
    if (!org) {
      return res.status(404).json({ error: "Organización no encontrada" });
    }
    const orgBranchIds = new Set((await db.branches.findMany()).filter((b: any) => b.organizationId === org.id).map((b: any) => b.id));
    if (!orgBranchIds.has(req.user!.branchId)) {
      return res.status(403).json({ error: "No tienes acceso a esta organización" });
    }
    const branchCount = orgBranchIds.size;
    const basePrice = Number(await db.systemSettings.getValue("subscription_base_price", "5000"));
    const perBranchPrice = Number(await db.systemSettings.getValue("subscription_per_branch_price", "1000"));
    const totalPrice = basePrice + Math.max(0, branchCount - 1) * perBranchPrice;
    return res.json({
      basePrice,
      perBranchPrice,
      branchCount,
      totalPrice,
      currency: "CUP",
      transfermovilPhone: await db.systemSettings.getValue("transfermovil_phone", "+53 51234567"),
      enzonaUser: await db.systemSettings.getValue("enzona_user", "nimbo.erp"),
      businessName: await db.systemSettings.getValue("business_name", "Nimbo ERP"),
    });
  });

  app.post("/api/subscription/pay", authenticate, async (req, res) => {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { orgId, platform, phone, transactionId, amount, userId } = parsed.data;

    const org = await db.organizations.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organización no encontrada" });
    }

    const orgBranchIds = new Set((await db.branches.findMany()).filter((b: any) => b.organizationId === orgId).map((b: any) => b.id));
    if (!orgBranchIds.has(req.user!.branchId)) {
      return res.status(403).json({ error: "No puedes pagar por una organización que no es tuya" });
    }

    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    const updatedOrg = await db.organizations.update(orgId, {
      subscriptionStatus: "active",
      subscriptionExpiresAt: expires.toISOString(),
      lastPaymentDate: new Date().toISOString(),
      paymentPlatform: platform,
      paymentPhone: phone || "",
      paymentTxId: transactionId,
    });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "PAY_SUBSCRIPTION", "Organization", orgId, `Paid ${amount} CUP via ${platform} with TxId: ${transactionId}`);

    let paymentRecord: any = null;
    try {
      paymentRecord = await db.subscriptionPayments.create({
        organizationId: orgId,
        amount: Number(amount),
        currency: Currency.CUP,
        platform,
        phone: phone || "",
        transactionId,
        status: "verified",
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to create subscriptionPayment record");
    }

    try {
      const trans = await db.cashRegisterTransactions.create({
        amount: Number(amount),
        type: "income",
        currency: Currency.CUP,
        description: `Pago mensual suscripción Nimbo ERP: Org ${org.name} (Plataforma: ${platform}, Ref: ${transactionId})`,
        category: "Suscripciones",
        userId: auditUserId,
      });
      await db.journalEntries.create({
        description: `Ingreso por Suscripción mensual ERP: ${org.name}`,
        reference: trans.id,
        status: "posted",
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to log subscription to journal");
    }

    const payer = await db.users.findById(auditUserId);
    const branchCount = orgBranchIds.size;

    return res.json({
      success: true,
      message: "Pago registrado con éxito. Suscripción renovada por 30 días.",
      organization: updatedOrg,
      receipt: {
        paymentId: paymentRecord?.id || null,
        orgName: org.name,
        businessName: await db.systemSettings.getValue("business_name", "Nimbo ERP"),
        amount: Number(amount),
        currency: "CUP",
        platform,
        transactionId,
        phone: phone || "",
        date: new Date().toISOString(),
        expiresAt: expires.toISOString(),
        payerName: payer?.name || "",
        payerEmail: payer?.email || "",
        branchCount,
      },
    });
  });

  // --- Products ---

  app.get("/api/products", authSub, async (req, res) => {
    const productsList = await db.products.findManyByOrg(req.orgId!);
    const variantsList = await db.variants.findManyByOrg(req.orgId!);
    const categoriesList = await db.categories.findManyByOrg(req.orgId!);
    const taxesList = await db.taxes.findManyByOrg(req.orgId!);

    const detailed = productsList.map((p) => {
      const vars = variantsList.filter((v) => v.productId === p.id);
      const cat = categoriesList.find((c) => c.id === p.categoryId);
      const tax = taxesList.find((t) => t.id === p.taxId);
      return { ...p, variants: vars, category: cat, tax };
    });

    return res.json(detailed);
  });

  app.post("/api/products", authSub, async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const {
      name, description, sku, barcode, unitOfMeasure, isService,
      categoryId, taxId, priceCUP, priceUSD, costCUP, costUSD, imageUrl, variants, userId
    } = parsed.data;

    const prod = await db.products.create({
      name,
      description: description || "",
      sku: sku || "",
      barcode: barcode || "",
      unitOfMeasure: unitOfMeasure || "pieza",
      isService: !!isService,
      categoryId: categoryId || undefined,
      taxId: taxId || undefined,
      priceCUP: Number(priceCUP) || 0,
      priceUSD: Number(priceUSD) || 0,
      costCUP: Number(costCUP) || 0,
      costUSD: Number(costUSD) || 0,
      imageUrl: imageUrl || "",
      organizationId: req.orgId!,
    });

    if (variants && Array.isArray(variants)) {
      for (const v of variants) {
        await db.variants.create({
          productId: prod.id,
          name: v.name,
          sku: v.sku || "",
          barcode: v.barcode || "",
          priceCUP: Number(v.priceCUP) || 0,
          priceUSD: Number(v.priceUSD) || 0,
          costCUP: Number(v.costCUP) || 0,
          costUSD: Number(v.costUSD) || 0,
          stock: Number(v.stock) || 0,
          organizationId: req.orgId!,
        });
      }
    }

    const warehouses = await db.warehouses.findManyByOrg(req.orgId!);
    for (const w of warehouses) {
      if (variants && Array.isArray(variants) && variants.length > 0) {
        const freshVars = await db.variants.findByProductId(prod.id);
        for (const fv of freshVars) {
          await db.stocks.create({
            productId: prod.id,
            variantId: fv.id,
            warehouseId: w.id,
            quantity: fv.stock,
            minStock: 5,
            maxStock: 9999,
            organizationId: req.orgId!,
          });
        }
      } else {
        await db.stocks.create({
          productId: prod.id,
          warehouseId: w.id,
          quantity: 0,
          minStock: 5,
          maxStock: 9999,
          organizationId: req.orgId!,
        });
      }
    }

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "CREATE", "Product", prod.id, `Created product ${name}`);

    return res.json(prod);
  });

  app.put("/api/products/:id", authSub, async (req, res) => {
    const { id } = req.params;
    const {
      name, description, sku, barcode, unitOfMeasure, isService,
      categoryId, taxId, priceCUP, priceUSD, costCUP, costUSD, imageUrl, variants, userId
    } = req.body;

    const updated = await db.products.update(id, {
      name, description, sku, barcode, unitOfMeasure,
      isService: !!isService, categoryId, taxId,
      priceCUP: Number(priceCUP) || 0,
      priceUSD: Number(priceUSD) || 0,
      costCUP: Number(costCUP) || 0,
      costUSD: Number(costUSD) || 0,
      imageUrl,
    });

    if (!updated) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    if (variants && Array.isArray(variants)) {
      await db.variants.deleteByProductId(id);
      for (const v of variants) {
        await db.variants.create({
          productId: id,
          name: v.name,
          sku: v.sku || "",
          barcode: v.barcode || "",
          priceCUP: Number(v.priceCUP) || 0,
          priceUSD: Number(v.priceUSD) || 0,
          costCUP: Number(v.costCUP) || 0,
          costUSD: Number(v.costUSD) || 0,
          stock: Number(v.stock) || 0,
        });
      }
    }

    const auditUserId = userId || req.user?.userId;
    if (auditUserId) {
      logAudit(auditUserId, "UPDATE", "Product", id, `Updated product ${name}`);
    }

    return res.json(updated);
  });

  // --- Categories ---

  app.get("/api/categories", authSub, async (req, res) => {
    return res.json(await db.categories.findManyByOrg(req.orgId!));
  });

  app.post("/api/categories", authSub, async (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: "Nombre es requerido" });
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const item = await db.categories.create({ name, slug, parentId, organizationId: req.orgId! });
    logAudit(req.body.userId || "sistema", "CREATE", "Category", item.id, `Created category ${name}`);
    return res.json(item);
  });

  // --- Inventory ---

  app.get("/api/inventario", authSub, async (req, res) => {
    const stocks = await db.stocks.findManyByOrg(req.orgId!);
    const products = await db.products.findManyByOrg(req.orgId!);
    const variants = await db.variants.findManyByOrg(req.orgId!);
    const warehouses = await db.warehouses.findManyByOrg(req.orgId!);

    const detailedStocks = stocks.map((s) => {
      const p = products.find((x) => x.id === s.productId);
      const v = s.variantId ? variants.find((x) => x.id === s.variantId) : null;
      const w = warehouses.find((x) => x.id === s.warehouseId);
      return { ...s, product: p, variant: v, warehouse: w };
    });

    return res.json({
      stocks: detailedStocks,
      warehouses,
      movements: (await db.stockMovements.findMany()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50),
      transfers: (await db.transfers.findMany()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  });

  app.post("/api/inventario/movimiento", authSub, async (req, res) => {
    const { stockId, type, quantity, reason, userId } = req.body;
    if (!stockId || !type || quantity === undefined) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const stocksList = await db.stocks.findMany();
    const sIdx = stocksList.findIndex((x) => x.id === stockId);
    if (sIdx === -1) {
      return res.status(404).json({ error: "Stock no encontrado" });
    }

    const stock = stocksList[sIdx];
    const qtyChange = Number(quantity);
    let finalQty = stock.quantity;

    if (type === "entrada") {
      finalQty += qtyChange;
    } else if (type === "salida") {
      finalQty -= qtyChange;
    } else if (type === "ajuste") {
      finalQty = qtyChange;
    }

    await db.stocks.update(stockId, { quantity: Math.max(0, finalQty) });

    const mov = await db.stockMovements.create({
      stockId,
      type,
      quantity: qtyChange,
      reason: reason || "Movimiento manual",
      userId: userId || req.user!.userId,
    });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "STOCK_MOVEMENT", "Stock", stockId, `Registered ${type} of ${qtyChange} units. Reason: ${reason}`);

    return res.json(mov);
  });

  app.post("/api/inventario/transferencia", authSub, async (req, res) => {
    const { fromWarehouseId, toWarehouseId, items, userId } = req.body;
    if (!fromWarehouseId || !toWarehouseId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }

    const transfer = await db.transfers.create({
      fromWarehouseId,
      toWarehouseId,
      status: "completada",
      items,
      createdBy: userId || req.user!.userId,
    });

    const stocks = await db.stocks.findMany();

    for (const item of items) {
      const srcStock = stocks.find(
        (s) => s.warehouseId === fromWarehouseId && s.productId === item.productId && s.variantId === item.variantId
      );
      let destStock = stocks.find(
        (s) => s.warehouseId === toWarehouseId && s.productId === item.productId && s.variantId === item.variantId
      );
      const qty = Number(item.quantity);

      if (srcStock) {
        await db.stocks.update(srcStock.id, { quantity: Math.max(0, srcStock.quantity - qty) });
        await db.stockMovements.create({
          stockId: srcStock.id,
          type: "transferencia",
          quantity: qty,
          reason: `Transferencia enviada a almacén ${toWarehouseId}`,
          userId: userId || req.user!.userId,
        });
      }

      if (!destStock) {
        destStock = await db.stocks.create({
          productId: item.productId,
          variantId: item.variantId,
          warehouseId: toWarehouseId,
          quantity: 0,
          minStock: 5,
          maxStock: 9999,
        });
      }

      await db.stocks.update(destStock.id, { quantity: destStock.quantity + qty });
      await db.stockMovements.create({
        stockId: destStock.id,
        type: "transferencia",
        quantity: qty,
        reason: `Transferencia recibida de almacén ${fromWarehouseId}`,
        userId: userId || req.user!.userId,
      });
    }
    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "TRANSFER", "Warehouse", fromWarehouseId, `Transferred items to warehouse ${toWarehouseId}`);

    return res.json(transfer);
  });

  // --- POS ---

  app.get("/api/pos/sessions", authSub, async (req, res) => {
    const sessions = await db.cashRegisterSessions.findManyByOrg(req.orgId!);
    return res.json(sessions);
  });

  app.post("/api/pos/sessions/start", authSub, async (req, res) => {
    const { branchId, initialCash, userId } = req.body;
    if (!(await isBranchInOrg(branchId, req.orgId!))) {
      return res.status(403).json({ error: "La sucursal especificada no pertenece a tu organización" });
    }
    const session = await db.cashRegisterSessions.create({
      branchId,
      userId: userId || req.user!.userId,
      initialCash: Number(initialCash) || 0,
      status: "open",
      organizationId: req.orgId!,
    });
    return res.json(session);
  });

  app.post("/api/pos/sessions/close", authSub, async (req, res) => {
    const { sessionId, countedCash, expectedCash } = req.body;
    const session = await db.cashRegisterSessions.update(sessionId, {
      status: "closed",
      endDate: new Date().toISOString(),
      countedCash: Number(countedCash) || 0,
      expectedCash: Number(expectedCash) || 0,
    });
    return res.json(session);
  });

  // --- Sales ---

  app.get("/api/sales", authSub, async (req, res) => {
    const sales = await db.sales.findManyByOrg(req.orgId!);
    const customers = await db.customers.findManyByOrg(req.orgId!);
    const detailed = await Promise.all(sales.map(async (s) => ({
      ...s,
      customer: customers.find((c) => c.id === s.customerId) || null,
      items: (await db.saleItems.findMany()).filter((i) => i.saleId === s.id),
    })));
    return res.json(detailed);
  });

  app.post("/api/sales", authSub, async (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const {
      branchId, customerId, items, totalCUP, totalUSD,
      taxTotalCUP, taxTotalUSD, discount, grandTotalCUP, grandTotalUSD,
      paymentMethod, payments, userId, isCredit, loyaltyPointsRedeemed,
    } = parsed.data;

    if (!(await isBranchInOrg(branchId, req.orgId!))) {
      return res.status(403).json({ error: "La sucursal especificada no pertenece a tu organización" });
    }

    const sale = await db.sales.create({
      branchId,
      customerId: customerId || undefined,
      date: new Date().toISOString(),
      totalCUP: Number(totalCUP) || 0,
      totalUSD: Number(totalUSD) || 0,
      taxTotalCUP: Number(taxTotalCUP) || 0,
      taxTotalUSD: Number(taxTotalUSD) || 0,
      discount: Number(discount) || 0,
      grandTotalCUP: Number(grandTotalCUP) || 0,
      grandTotalUSD: Number(grandTotalUSD) || 0,
      paymentMethod: paymentMethod || "efectivo",
      status: "completed",
      userId: userId || req.user!.userId,
      organizationId: req.orgId!,
    });

    const stocks = await db.stocks.findManyByOrg(req.orgId!);
    const branchWarehouse = (await db.warehouses.findManyByOrg(req.orgId!)).find((w) => w.branchId === branchId);

    for (const item of items) {
      await db.saleItems.create({
        saleId: sale.id,
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: Number(item.quantity),
        unitPriceCUP: Number(item.priceCUP) || 0,
        unitPriceUSD: Number(item.priceUSD) || 0,
        tax: Number(item.tax) || 0,
        discount: Number(item.discount) || 0,
      });

      if (branchWarehouse) {
        const matchingStock = stocks.find(
          (s) => s.warehouseId === branchWarehouse.id && s.productId === item.productId && (!item.variantId || s.variantId === item.variantId)
        );
        if (matchingStock) {
          await db.stocks.update(matchingStock.id, { quantity: Math.max(0, matchingStock.quantity - Number(item.quantity)) });
          await db.stockMovements.create({
            stockId: matchingStock.id,
            type: "salida",
            quantity: Number(item.quantity),
            reason: `Venta POS ${sale.id}`,
            userId: userId || req.user!.userId,
            organizationId: req.orgId!,
          });
        }
      }
    }

    if (payments && Array.isArray(payments)) {
      for (const p of payments) {
        await db.payments.create({
          saleId: sale.id,
          method: p.method || paymentMethod,
          currency: p.currency || Currency.CUP,
          amount: Number(p.amount),
          reference: p.reference || undefined,
        });
      }
    } else {
      await db.payments.create({
        saleId: sale.id,
        method: paymentMethod || "efectivo",
        currency: (grandTotalUSD || 0) > 0 ? Currency.USD : Currency.CUP,
        amount: (grandTotalUSD || 0) > 0 ? (grandTotalUSD || 0) : (grandTotalCUP || 0),
        reference: paymentMethod !== "efectivo" ? `REF-${Math.floor(Math.random() * 900000) + 100000}` : undefined,
      });
    }

    if (customerId) {
      const customer = await db.customers.findById(customerId);
      if (customer) {
        let newBalance = customer.currentBalance;
        let newPoints = customer.loyaltyPoints;
        if (isCredit) {
          newBalance += Number(grandTotalCUP);
        }
        const pointsEarned = Math.floor((grandTotalCUP || 0) / 100);
        newPoints += pointsEarned;
        if (loyaltyPointsRedeemed) {
          newPoints = Math.max(0, newPoints - Number(loyaltyPointsRedeemed));
        }
        await db.customers.update(customerId, { currentBalance: newBalance, loyaltyPoints: newPoints });
      }
    }

    const entry = await db.journalEntries.create({
      description: `Ingreso por Venta POS ${sale.id}`,
      reference: sale.id,
      status: "posted",
      organizationId: req.orgId!,
    });
    await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: Number(grandTotalCUP) || 0, credit: 0 });
    await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: 0, credit: Number(grandTotalCUP) || 0 });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "CREATE_SALE", "Sale", sale.id, `Completed sale of ${grandTotalCUP} CUP`);

    return res.json(sale);
  });

  app.post("/api/sales/:id/refund", authSub, async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const sale = await db.sales.findById(id);
    if (!sale) return res.status(404).json({ error: "Venta no encontrada" });

    await db.sales.update(id, { status: "refunded" });

    const items = (await db.saleItems.findMany()).filter((i) => i.saleId === id);
    const branchWarehouse = (await db.warehouses.findManyByOrg(req.orgId!)).find((w) => w.branchId === sale.branchId);
    const stocks = await db.stocks.findManyByOrg(req.orgId!);

    if (branchWarehouse) {
      for (const item of items) {
        const matchingStock = stocks.find(
          (s) => s.warehouseId === branchWarehouse.id && s.productId === item.productId && (!item.variantId || s.variantId === item.variantId)
        );
        if (matchingStock) {
          await db.stocks.update(matchingStock.id, { quantity: matchingStock.quantity + item.quantity });
          await db.stockMovements.create({
            stockId: matchingStock.id,
            type: "entrada",
            quantity: item.quantity,
            reason: `Devolución Venta ${id}`,
            userId: userId || req.user!.userId,
            organizationId: req.orgId!,
          });
        }
      }
    }

    const entry = await db.journalEntries.create({
      description: `Reverso de Venta ${id}`,
      reference: id,
      status: "posted",
      organizationId: req.orgId!,
    });
    await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: Number(sale.grandTotalCUP), credit: 0 });
    await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: Number(sale.grandTotalCUP) });

    const auditUserId = userId || req.user?.userId;
    if (auditUserId) {
      logAudit(auditUserId, "REFUND_SALE", "Sale", id, `Refunded sale ${id}`);
    }

    return res.json({ success: true });
  });

  // --- Orders ---

  app.get("/api/orders", authSub, async (req, res) => {
    const orders = await db.orders.findManyByOrg(req.orgId!);
    const customers = await db.customers.findManyByOrg(req.orgId!);
    const detailed = await Promise.all(orders.map(async (o) => ({
      ...o,
      customer: customers.find((c) => c.id === o.customerId) || null,
      items: (await db.orderItems.findMany()).filter((i) => i.orderId === o.id),
    })));
    return res.json(detailed);
  });

  app.post("/api/orders", authSub, async (req, res) => {
    const { branchId, customerId, items, deliveryDate, totalCUP, totalUSD, notes, deliveryAddress, assignedDriverId, advancePayment } = req.body;
    if (!(await isBranchInOrg(branchId, req.orgId!))) {
      return res.status(403).json({ error: "La sucursal especificada no pertenece a tu organización" });
    }
    const order = await db.orders.create({
      branchId, customerId, deliveryDate, status: "pending",
      totalCUP: Number(totalCUP) || 0, totalUSD: Number(totalUSD) || 0,
      notes: notes || "", deliveryAddress: deliveryAddress || "",
      assignedDriverId: assignedDriverId || "", advancePayment: Number(advancePayment) || 0,
      organizationId: req.orgId!,
    });
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await db.orderItems.create({
          orderId: order.id, productId: item.productId, variantId: item.variantId || undefined,
          quantity: Number(item.quantity), unitPriceCUP: Number(item.priceCUP) || 0, unitPriceUSD: Number(item.priceUSD) || 0,
        });
      }
    }
    const auditUserId = req.body.userId || req.user!.userId;
    logAudit(auditUserId, "CREATE_ORDER", "Order", order.id, `Created order for ${totalCUP} CUP`);
    return res.json(order);
  });

  app.put("/api/orders/:id/status", authSub, async (req, res) => {
    const { id } = req.params;
    const { status, assignedDriverId } = req.body;
    const order = await db.orders.update(id, { status, assignedDriverId });
    logAudit(req.body.userId || req.user!.userId, "UPDATE_ORDER_STATUS", "Order", id, `Status changed to ${status}`);
    return res.json(order);
  });

  // --- Purchases ---

  app.get("/api/compras", authSub, async (req, res) => {
    const suppliers = await db.suppliers.findManyByOrg(req.orgId!);
    const purchaseOrders = await db.purchaseOrders.findManyByOrg(req.orgId!);
    const items = await db.purchaseOrderItems.findMany();
    const invoices = await db.supplierInvoices.findManyByOrg(req.orgId!);
    const products = await db.products.findManyByOrg(req.orgId!);

    const detailedOrders = purchaseOrders.map((po) => {
      const sup = suppliers.find((s) => s.id === po.supplierId);
      const poItems = items.filter((i) => i.purchaseOrderId === po.id).map((i) => ({ ...i, product: products.find((p) => p.id === i.productId) }));
      return { ...po, supplier: sup, items: poItems };
    });

    const detailedInvoices = invoices.map((inv) => ({ ...inv, supplier: suppliers.find((s) => s.id === inv.supplierId) }));

    return res.json({ suppliers, purchaseOrders: detailedOrders, invoices: detailedInvoices });
  });

  app.post("/api/compras/suppliers", authSub, async (req, res) => {
    const { name, contact, taxId, email, phone, address, paymentTerms } = req.body;
    const item = await db.suppliers.create({ name, contact, taxId, email, phone, address, paymentTerms, organizationId: req.orgId! });
    logAudit(req.body.userId || req.user!.userId, "CREATE", "Supplier", item.id, `Created supplier ${name}`);
    return res.json(item);
  });

  app.post("/api/compras/orders", authSub, async (req, res) => {
    const { supplierId, warehouseId, notes, createdBy, items } = req.body;
    const po = await db.purchaseOrders.create({
      supplierId, warehouseId, status: "draft", notes,
      orderDate: new Date().toISOString().substring(0, 10),
      createdBy: createdBy || "admin",
      organizationId: req.orgId!,
    });
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await db.purchaseOrderItems.create({
          purchaseOrderId: po.id, productId: item.productId, variantId: item.variantId || undefined,
          quantity: Number(item.quantity), unitCostCUP: Number(item.costCUP) || 0, unitCostUSD: Number(item.costUSD) || 0, receivedQty: 0,
        });
      }
    }
    logAudit(req.body.createdBy || "sistema", "CREATE_PURCHASE_ORDER", "PurchaseOrder", po.id);
    return res.json(po);
  });

  app.post("/api/compras/orders/:id/receive", authSub, async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const po = await db.purchaseOrders.update(id, { status: "received" });
    if (!po) return res.status(404).json({ error: "Orden no encontrada" });

    const poItems = (await db.purchaseOrderItems.findMany()).filter((i) => i.purchaseOrderId === id);
    const stocks = await db.stocks.findManyByOrg(req.orgId!);
    let totalCUP = 0;
    let totalUSD = 0;

    for (const poi of poItems) {
      await db.purchaseOrderItems.update(poi.id, { receivedQty: poi.quantity });
      let matchingStock = stocks.find((s) => s.warehouseId === po.warehouseId && s.productId === poi.productId && (!poi.variantId || s.variantId === poi.variantId));
      if (!matchingStock) {
        matchingStock = await db.stocks.create({ productId: poi.productId, variantId: poi.variantId, warehouseId: po.warehouseId, quantity: 0, minStock: 5, maxStock: 9999, organizationId: req.orgId! });
      }
      await db.stocks.update(matchingStock.id, { quantity: matchingStock.quantity + poi.quantity });
      await db.stockMovements.create({ stockId: matchingStock.id, type: "entrada", quantity: poi.quantity, reason: `Recepción Orden Compra ${id}`, userId: userId || req.user!.userId, organizationId: req.orgId! });
      totalCUP += poi.quantity * poi.unitCostCUP;
      totalUSD += poi.quantity * poi.unitCostUSD;
    }

    await db.supplierInvoices.create({ supplierId: po.supplierId, purchaseOrderId: po.id, totalCUP, totalUSD, paidAmountCUP: 0, paidAmountUSD: 0, status: "pendiente", organizationId: req.orgId! });

    const entry = await db.journalEntries.create({ description: `Recepción Orden de Compra ${id}`, reference: id, status: "posted", organizationId: req.orgId! });
    await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1040", debit: totalCUP, credit: 0 });
    await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "2010", debit: 0, credit: totalCUP });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "RECEIVE_PURCHASE", "PurchaseOrder", id, `Received purchase order ${id} with total ${totalCUP} CUP`);

    return res.json(po);
  });

  app.post("/api/compras/invoices/:id/pay", authSub, async (req, res) => {
    const { id } = req.params;
    const { amountCUP, amountUSD, userId } = req.body;
    const inv = (await db.supplierInvoices.findMany()).find((x) => x.id === id);
    if (!inv) return res.status(404).json({ error: "Factura no encontrada" });

    const updatedPaidCUP = inv.paidAmountCUP + (Number(amountCUP) || 0);
    const updatedPaidUSD = inv.paidAmountUSD + (Number(amountUSD) || 0);
    const status = (updatedPaidCUP >= inv.totalCUP) ? "pagada" : "pendiente";

    const updated = await db.supplierInvoices.update(id, { paidAmountCUP: updatedPaidCUP, paidAmountUSD: updatedPaidUSD, status });

    const entry = await db.journalEntries.create({ description: `Pago Factura Proveedor ${id}`, reference: id, status: "posted", organizationId: req.orgId! });
    await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "2010", debit: Number(amountCUP) || 0, credit: 0 });
    await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: Number(amountCUP) || 0 });

    return res.json(updated);
  });

  // --- Customers ---

  app.get("/api/clientes", authSub, async (req, res) => {
    return res.json(await db.customers.findManyByOrg(req.orgId!));
  });

  app.post("/api/clientes", authSub, async (req, res) => {
    const { name, email, phone, address, taxId, creditLimit } = req.body;
    const client = await db.customers.create({
      name, email: email || "", phone: phone || "", address: address || "",
      taxId: taxId || "", creditLimit: Number(creditLimit) || 0, currentBalance: 0, loyaltyPoints: 0,
      organizationId: req.orgId!,
    });
    logAudit(req.body.userId || req.user!.userId, "CREATE", "Customer", client.id, `Created customer ${name}`);
    return res.json(client);
  });

  app.put("/api/clientes/:id", authSub, async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address, taxId, creditLimit, loyaltyPoints } = req.body;
    const updated = await db.customers.update(id, {
      name, email, phone, address, taxId,
      creditLimit: creditLimit !== undefined ? Number(creditLimit) : undefined,
      loyaltyPoints: loyaltyPoints !== undefined ? Number(loyaltyPoints) : undefined,
    });
    logAudit(req.body.userId || req.user!.userId, "UPDATE", "Customer", id, `Updated customer ${name}`);
    return res.json(updated);
  });

  app.post("/api/clientes/campana", authSub, async (req, res) => {
    const { name, message, customerIds } = req.body;
    logAudit(req.user!.userId, "SEND_CAMPAIGN", "Customer", "multiple", `Sent campaign '${name}' to ${customerIds ? customerIds.length : 0} customers. Message: ${message}`);
    return res.json({ success: true, logged: true });
  });

  // --- Production ---

  app.get("/api/produccion", authSub, async (req, res) => {
    const recipes = await db.recipes.findManyByOrg(req.orgId!);
    const ingredients = await db.recipeIngredients.findMany();
    const productionOrders = await db.productionOrders.findManyByOrg(req.orgId!);
    const products = await db.products.findManyByOrg(req.orgId!);
    const warehouses = await db.warehouses.findManyByOrg(req.orgId!);

    const detailedRecipes = recipes.map((r) => {
      const rIngs = ingredients.filter((i) => i.recipeId === r.id).map((i) => ({ ...i, ingredientProduct: products.find((p) => p.id === i.ingredientProductId) }));
      return { ...r, product: products.find((p) => p.id === r.productId), ingredients: rIngs };
    });

    const detailedOrders = productionOrders.map((po) => ({
      ...po,
      product: products.find((p) => p.id === po.productId),
      recipe: recipes.find((r) => r.id === po.recipeId),
      warehouse: warehouses.find((w) => w.id === po.warehouseId),
    }));

    return res.json({ recipes: detailedRecipes, productionOrders: detailedOrders });
  });

  app.post("/api/produccion/recipes", authSub, async (req, res) => {
    const { name, productId, yieldQuantity, yieldUnit, ingredients } = req.body;
    const rec = await db.recipes.create({ name, productId, yieldQuantity: Number(yieldQuantity) || 1, yieldUnit: yieldUnit || "pieza", organizationId: req.orgId! });
    if (ingredients && Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        await db.recipeIngredients.create({ recipeId: rec.id, ingredientProductId: ing.ingredientProductId, quantity: Number(ing.quantity), unit: ing.unit || "kg", wastePercent: Number(ing.wastePercent) || 0 });
      }
    }
    logAudit(req.body.userId || "sistema", "CREATE", "Recipe", rec.id, `Created recipe ${name}`);
    return res.json(rec);
  });

  app.delete("/api/produccion/recipes/:id", authSub, authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.PRODUCCION), async (req, res) => {
    const { id } = req.params;
    await db.recipeIngredients.deleteByRecipeId(id);
    await db.recipes.delete(id);
    logAudit(req.body.userId || req.user!.userId, "DELETE", "Recipe", id);
    return res.json({ success: true });
  });

  app.post("/api/produccion/orders", authSub, async (req, res) => {
    const { productId, recipeId, plannedQuantity, warehouseId, notes } = req.body;
    const order = await db.productionOrders.create({ productId, recipeId: recipeId || undefined, plannedQuantity: Number(plannedQuantity), producedQuantity: 0, status: "planned", warehouseId, notes: notes || "", organizationId: req.orgId! });
    logAudit(req.body.userId || "sistema", "CREATE", "ProductionOrder", order.id, `Planned ${plannedQuantity} units`);
    return res.json(order);
  });

  app.post("/api/produccion/orders/:id/start", authSub, async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const order = (await db.productionOrders.findManyByOrg(req.orgId!)).find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: "Orden de producción no encontrada" });

    await db.productionOrders.update(id, { status: "in_progress", startDate: new Date().toISOString() });

    if (order.recipeId) {
      const ingredients = (await db.recipeIngredients.findMany()).filter((i) => i.recipeId === order.recipeId);
      const stocks = await db.stocks.findManyByOrg(req.orgId!);
      for (const ing of ingredients) {
        const requiredQty = (ing.quantity * order.plannedQuantity) * (1 + ing.wastePercent / 100);
        const matchingStock = stocks.find((s) => s.warehouseId === order.warehouseId && s.productId === ing.ingredientProductId);
        if (matchingStock) {
          await db.stocks.update(matchingStock.id, { quantity: Math.max(0, matchingStock.quantity - requiredQty) });
          await db.stockMovements.create({ stockId: matchingStock.id, type: "salida", quantity: requiredQty, reason: `Consumo ingredientes Orden Producción ${id}`, userId: userId || req.user!.userId, organizationId: req.orgId! });
        }
      }
    }

    return res.json({ success: true });
  });

  app.post("/api/produccion/orders/:id/complete", authSub, async (req, res) => {
    const { id } = req.params;
    const { producedQuantity, userId } = req.body;
    const order = (await db.productionOrders.findManyByOrg(req.orgId!)).find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: "Orden de producción no encontrada" });

    const qty = Number(producedQuantity) || order.plannedQuantity;
    await db.productionOrders.update(id, { status: "completed", endDate: new Date().toISOString(), producedQuantity: qty });

    const stocks = await db.stocks.findManyByOrg(req.orgId!);
    let finishedStock = stocks.find((s) => s.warehouseId === order.warehouseId && s.productId === order.productId);
    if (!finishedStock) {
      finishedStock = await db.stocks.create({ productId: order.productId, warehouseId: order.warehouseId, quantity: 0, minStock: 5, maxStock: 9999, organizationId: req.orgId! });
    }
    await db.stocks.update(finishedStock.id, { quantity: finishedStock.quantity + qty });
    await db.stockMovements.create({ stockId: finishedStock.id, type: "entrada", quantity: qty, reason: `Producción de orden terminada ${id}`, userId: userId || req.user!.userId, organizationId: req.orgId! });

    return res.json({ success: true });
  });

  // --- Finances ---

  app.get("/api/finanzas", authSub, async (req, res) => {
    const accounts = await db.accounts.findManyByOrg(req.orgId!);
    const journalEntries = await db.journalEntries.findManyByOrg(req.orgId!);
    const lines = await db.journalEntryLines.findMany();
    const trans = await db.cashRegisterTransactions.findManyByOrg(req.orgId!);

    const detailedAccounts = accounts.map((acc) => {
      const accLines = lines.filter((l) => l.accountId === acc.id);
      let balance = 0;
      accLines.forEach((l) => {
        if (acc.type === "asset" || acc.type === "expense") {
          balance += l.debit - l.credit;
        } else {
          balance += l.credit - l.debit;
        }
      });
      return { ...acc, balance };
    });

    return res.json({
      accounts: detailedAccounts,
      journalEntries: journalEntries.map((je) => ({
        ...je,
        lines: lines.filter((l) => l.journalEntryId === je.id).map((l) => ({ ...l, account: accounts.find((a) => a.id === l.accountId) })),
      })),
      transactions: trans,
    });
  });

  app.post("/api/finanzas/transactions", authSub, authorize(Role.CONTABLE, Role.ADMIN, Role.SUPER_ADMIN), async (req, res) => {
    const { type, amount, currency, description, category, userId } = req.body;
    if (!type || !amount) return res.status(400).json({ error: "Campos requeridos vacíos" });

    const trans = await db.cashRegisterTransactions.create({
      type, amount: Number(amount), currency: currency || Currency.CUP,
      description: description || "", category: category || "General",
      userId: userId || req.user!.userId,
    });

    const entry = await db.journalEntries.create({ description: `Transacción Caja No Operativa: ${description}`, reference: trans.id, status: "posted" });
    const isIncome = type === "income";
    const amt = Number(amount);
    if (isIncome) {
      await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: amt, credit: 0 });
      await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: 0, credit: amt });
    } else {
      await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "5030", debit: amt, credit: 0 });
await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: amt });
    }
    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "CREATE_TRANSACTION", "CashTransaction", trans.id, `${type} ${amount} ${currency} - ${description}`);
    return res.json(trans);
  });

  // --- HR ---

  app.get("/api/rrhh", authSub, async (req, res) => {
    const employees = await db.employees.findManyByOrg(req.orgId!);
    const attendances = await db.attendances.findMany();
    const periods = await db.payrollPeriods.findMany();
    const details = await db.payrollDetails.findMany();

    const detailedEmployees = employees.map((emp) => ({ ...emp, attendances: attendances.filter((a) => a.employeeId === emp.id) }));
    const detailedPeriods = periods.map((p) => ({
      ...p,
      details: details.filter((d) => d.payrollPeriodId === p.id).map((d) => ({ ...d, employee: employees.find((e) => e.id === d.employeeId) })),
    }));

    return res.json({ employees: detailedEmployees, periods: detailedPeriods });
  });

app.post("/api/rrhh/employees", authSub, async (req, res) => {
    const { firstName, lastName, hireDate, baseSalary, paymentType, bankAccount, taxId, socialSecurityNumber } = req.body;
    const emp = await db.employees.create({
      firstName, lastName, hireDate: hireDate || new Date().toISOString().substring(0, 10),
      baseSalary: Number(baseSalary) || 0, paymentType: paymentType || "salary",
      bankAccount: bankAccount || "", taxId: taxId || "", socialSecurityNumber: socialSecurityNumber || "",
      vacationDays: 24,
      organizationId: req.orgId!,
    });
    logAudit(req.body.userId || req.user!.userId, "CREATE", "Employee", emp.id, `Created employee ${firstName} ${lastName}`);
    return res.json(emp);
  });

  app.post("/api/rrhh/attendance", authSub, async (req, res) => {
    const { employeeId, date, checkIn, checkOut } = req.body;
    const inTime = checkIn ? new Date(`${date}T${checkIn}:00Z`) : null;
    const outTime = checkOut ? new Date(`${date}T${checkOut}:00Z`) : null;
    let hoursWorked = 0;
    if (inTime && outTime) {
      hoursWorked = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
    }
    const att = await db.attendances.create({
      employeeId, date,
      checkIn: checkIn ? `${date}T${checkIn}:00.000Z` : undefined,
      checkOut: checkOut ? `${date}T${checkOut}:00.000Z` : undefined,
      hoursWorked: hoursWorked > 0 ? Number(hoursWorked.toFixed(2)) : undefined,
    });
    logAudit(req.body.userId || "sistema", "CREATE", "Attendance", att.id, `Attendance for employee ${employeeId} on ${date}`);
    return res.json(att);
  });

  app.post("/api/rrhh/payroll", authSub, authorize(Role.RRHH, Role.ADMIN, Role.SUPER_ADMIN), async (req, res) => {
    const { startDate, endDate, employeeAdjustments } = req.body;
    const period = await db.payrollPeriods.create({ startDate, endDate, status: "draft", organizationId: req.orgId! });
    const employees = await db.employees.findManyByOrg(req.orgId!);

    for (const emp of employees) {
      const adj = employeeAdjustments ? employeeAdjustments[emp.id] : null;
      const base = emp.baseSalary;
      const overtime = adj ? Number(adj.overtime) || 0 : 0;
      const bonuses = adj ? Number(adj.bonuses) || 0 : 0;
      const deductions = adj ? Number(adj.deductions) || 0 : 0;
      const netPay = base + overtime + bonuses - deductions;

      await db.payrollDetails.create({ payrollPeriodId: period.id, employeeId: emp.id, baseAmount: base, overtime, bonuses, deductions, netPay });

      const entry = await db.journalEntries.create({ description: `Gasto Nómina Empleado: ${emp.firstName} ${emp.lastName}`, reference: period.id, status: "posted", organizationId: req.orgId! });
      await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "5020", debit: netPay, credit: 0 });
      await db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: netPay });
    }
    logAudit(req.user!.userId, "CREATE_PAYROLL", "PayrollPeriod", period.id, `Payroll ${startDate} to ${endDate}`);
    return res.json(period);
  });

  // --- User Management ---

  app.get("/api/users", authSub, async (req, res) => {
    const orgBranches = (await db.branches.findMany()).filter((b: any) => b.organizationId === req.orgId!);
    const orgBranchIds = new Set(orgBranches.map((b: any) => b.id));
    const allUsers = (await db.users.findMany()).filter((u: any) => orgBranchIds.has(u.branchId));
    const branches = await db.branches.findMany();

    let filtered = allUsers;
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.SUPER_ADMIN) {
      filtered = allUsers.filter((u) => u.branchId === req.user!.branchId);
    }

    const detailedUsers = filtered.map((u) => {
      const branch = branches.find((b) => b.id === u.branchId);
      return { ...u, password: undefined, branchName: branch ? branch.name : "Sin Sucursal" };
    });

    return res.json({ users: detailedUsers, branches });
  });

  app.post("/api/users", authSub, authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req, res) => {
    const { name, email, password, role, branchId } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: "Nombre, email y rol son requeridos" });
    }

    const isAdmin = req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN;
    const isSameBranch = req.user!.branchId === branchId || !branchId;

    if (!isAdmin && !isSameBranch) {
      return res.status(403).json({ error: "Solo puedes crear usuarios para tu propia sucursal" });
    }

    const existing = await db.users.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Ya existe un usuario registrado con este correo electrónico" });
    }

    let targetBranchId = isAdmin && branchId ? branchId : req.user!.branchId;
    if (targetBranchId && !(await isBranchInOrg(targetBranchId, req.orgId!))) {
      return res.status(403).json({ error: "La sucursal especificada no pertenece a tu organización" });
    }

    const hashedPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : undefined;

    const newUser = await db.users.create({
      name,
      email: email.trim().toLowerCase(),
      password: hashedPassword || (await bcrypt.hash("123456", SALT_ROUNDS)),
      role: role as Role,
      branchId: targetBranchId || ""
    });

    logAudit(req.user!.userId, "CREATE_USER", "User", newUser.id, `Usuario ${newUser.name} (${newUser.role}) creado`);
    return res.json({ success: true, user: { ...newUser, password: undefined } });
  });

  app.put("/api/users/:id", authSub, authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role, branchId } = req.body;

    const existing = await db.users.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isAdmin = req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN;
    if (!isAdmin && existing.branchId !== req.user!.branchId) {
      return res.status(403).json({ error: "Solo puedes modificar usuarios de tu propia sucursal" });
    }

    if (email && email.toLowerCase() !== existing.email.toLowerCase()) {
      const other = await db.users.findByEmail(email);
      if (other) {
        return res.status(400).json({ error: "El nuevo correo ya está en uso por otro usuario" });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.trim().toLowerCase();
    if (role) updateData.role = role as Role;
    if (isAdmin && branchId) updateData.branchId = branchId;
    if (password && password.trim() !== "") updateData.password = await bcrypt.hash(password, SALT_ROUNDS);

    const updatedUser = await db.users.update(id, updateData);
    logAudit(req.user!.userId, "UPDATE_USER", "User", id, `Usuario ${updatedUser?.name} actualizado`);
    return res.json({ success: true, user: { ...updatedUser, password: undefined } });
  });

  app.delete("/api/users/:id", authSub, authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req, res) => {
    const { id } = req.params;

    if (id === req.user!.userId) {
      return res.status(400).json({ error: "No puedes eliminar tu propio usuario en sesión activa" });
    }

    const existing = await db.users.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isAdmin = req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN;
    if (!isAdmin && existing.branchId !== req.user!.branchId) {
      return res.status(403).json({ error: "Solo puedes eliminar usuarios de tu propia sucursal" });
    }

    await db.users.delete(id);
    logAudit(req.user!.userId, "DELETE_USER", "User", id, `Usuario ${existing.name} (${existing.email}) eliminado`);
    return res.json({ success: true });
  });

  // --- Config ---

  app.get("/api/configuracion", authSub, async (_req, res) => {
    const settings = await db.systemSettings.findMany();
    const logs = (await db.auditLogs.findMany()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
    return res.json({ settings, logs, users: await db.users.findMany() });
  });

  app.post("/api/configuracion", authSub, authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req, res) => {
    const { settings, userId } = req.body;
    if (settings && typeof settings === "object") {
      for (const key of Object.keys(settings)) {
        await db.systemSettings.setValue(key, String(settings[key]));
      }
      logAudit(userId || req.user!.userId, "UPDATE_SETTINGS", "SystemSetting", "all", JSON.stringify(settings));
    }
    return res.json({ success: true });
  });

  app.post("/api/onboarding/dismiss", authSub, async (req, res) => {
    await db.systemSettings.setValue("onboarding_done", "1");
    logAudit(req.user!.userId, "ONBOARDING_DISMISSED", "SystemSetting", "onboarding_done");
    return res.json({ success: true });
  });

  const supportTicketSchema = z.object({
    subject: z.string().min(1, "Asunto requerido").max(120),
    message: z.string().min(10, "Describe tu consulta con al menos 10 caracteres").max(3000),
  });

  app.post("/api/support/ticket", authSub, async (req, res) => {
    const parsed = supportTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { subject, message } = parsed.data;
    const user = await db.users.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const ticket = await db.supportTickets.create({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      organizationId: user.branchId || "",
      subject,
      message,
    });
    logAudit(user.id, "SUPPORT_TICKET", "SupportTicket", ticket.id, `Tu ticket "${subject}" (id: ${ticket.id})`);

    const supportDestination = await db.systemSettings.getValue("support_email", "");
    if (supportDestination && supportDestination.includes("@")) {
      const sent = await sendMail(
        supportDestination,
        `[Nimbo ERP] Soporte: ${subject} (${user.email})`,
        `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0A0A0B;border-radius:12px;">` +
          `<p style="color:#cbd5e1;font-size:14px;">Nuevo ticket de <strong style="color:#fff;">${user.name}</strong> (${user.email})</p>` +
          `<div style="background:#151518;border:1px solid #1e293b;border-radius:8px;padding:16px;color:#e2e8f0;font-size:13px;line-height:1.6;">${message.replace(/</g, "&lt;")}</div>` +
          `<p style="color:#94a3b8;font-size:12px;">Ticket ID: ${ticket.id}</p></div>`
      );
      if (!sent) {
        logger.warn({ ticketId: ticket.id }, "Support SMTP not configured — ticket saved locally");
      }
    }

    return res.status(201).json({ success: true, ticket });
  });

  // --- ONAT Report ---

  app.get("/api/reportes/onat", authSub, async (req, res) => {
    const { month, year } = req.query;
    const m = month ? Number(month) : new Date().getMonth() + 1;
    const y = year ? Number(year) : new Date().getFullYear();
    const rate = Number(await db.systemSettings.getValue("exchange_rate_usd", "120"));

    const sales = await db.sales.findManyByOrg(req.orgId!);
    const inxs = await db.cashRegisterTransactions.findManyByOrg(req.orgId!);
    const pDetails = await db.payrollDetails.findMany();
    const invoices = await db.supplierInvoices.findManyByOrg(req.orgId!);

    const reportLines: Array<{ fecha: string; concepto: string; ingreso: number; gasto: number }> = [];

    const isTargetMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return (d.getMonth() + 1) === m && d.getFullYear() === y;
    };

    sales.forEach((s) => {
      if (isTargetMonth(s.date) && s.status === "completed") {
        const usdConverted = s.grandTotalUSD * rate;
        reportLines.push({ fecha: s.date.substring(0, 10), concepto: `Ingresos Ventas (Venta POS ${s.id.substring(0, 8)})`, ingreso: s.grandTotalCUP + usdConverted, gasto: 0 });
      }
    });

    inxs.forEach((t) => {
      if (isTargetMonth(t.date)) {
        const factor = t.currency === Currency.USD ? rate : 1;
        if (t.type === "income") {
          reportLines.push({ fecha: t.date.substring(0, 10), concepto: `Ingreso Caja: ${t.description}`, ingreso: t.amount * factor, gasto: 0 });
        } else {
          reportLines.push({ fecha: t.date.substring(0, 10), concepto: `Gasto Caja: ${t.description}`, ingreso: 0, gasto: t.amount * factor });
        }
      }
    });

    const purchaseOrders = await db.purchaseOrders.findMany();
    const payrollPeriods = await db.payrollPeriods.findMany();
    for (const inv of invoices) {
      const po = inv.purchaseOrderId ? purchaseOrders.find((p) => p.id === inv.purchaseOrderId) : null;
      const refDate = po ? po.createdAt : new Date().toISOString();
      if (isTargetMonth(refDate)) {
        const usdConverted = inv.totalUSD * rate;
        reportLines.push({ fecha: refDate.substring(0, 10), concepto: `Compra Proveedor (Factura ${inv.id.substring(0, 8)})`, ingreso: 0, gasto: inv.totalCUP + usdConverted });
      }
    }

    for (const d of pDetails) {
      const p = payrollPeriods.find((x) => x.id === d.payrollPeriodId);
      if (p && isTargetMonth(p.startDate)) {
        reportLines.push({ fecha: p.startDate.substring(0, 10), concepto: `Gasto de Salarios - Empleado ID ${d.employeeId.substring(0, 6)}`, ingreso: 0, gasto: d.netPay });
      }
    }

    reportLines.sort((a, b) => a.fecha.localeCompare(b.fecha));

    return res.json({ month: m, year: y, exchangeRate: rate, lines: reportLines });
  });

  // Backup trigger (admin only)
  app.post("/api/backup", authenticate, authorize(Role.SUPER_ADMIN), async (req, res) => {
    const dest = await createBackup();
    if (!dest) {
      return res.status(500).json({ error: "No se pudo crear el backup" });
    }
    logAudit(req.user!.userId, "BACKUP", "Database", dest);
    return res.json({ success: true, file: dest });
  });

  // --- Vite / Static Serving ---

  if (process.env.NODE_ENV === "development") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    logger.info("Vite development middleware integrated.");
  } else if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", async (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    logger.info("Serving production static files from dist.");
  }

  return app;
}

async function startServer() {
  await registerApp();
  if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, "0.0.0.0", () => {
      logger.info({ port: PORT, nodeEnv: process.env.NODE_ENV }, "Full-Stack ERP/POS server running");
      scheduleBackup();
      scheduleSubscriptionReminders();
    });
  }
}

const REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function runSubscriptionReminders(): Promise<void> {
  try {
    const orgs = (await db.organizations.findMany()).filter((o: any) => o.subscriptionStatus === "active");
    for (const org of orgs) {
      if (!org.subscriptionExpiresAt) continue;
      const expires = new Date(org.subscriptionExpiresAt).getTime();
      const now = Date.now();
      const daysLeft = Math.ceil((expires - now) / (24 * 60 * 60 * 1000));
      if (daysLeft < 0 || daysLeft > 7) continue;

      const reminderKey = `subscription_reminder_sent_${org.id}`;
      const lastSent = await db.systemSettings.getValue(reminderKey, "");
      const today = new Date().toISOString().slice(0, 10);
      if (lastSent === `${today}_${expires}`) continue;

      const orgBranchIds = new Set((await db.branches.findMany()).filter((b: any) => b.organizationId === org.id).map((b: any) => b.id));
      const orgUsers = (await db.users.findMany()).filter((u: any) => orgBranchIds.has(u.branchId));
      const payUrl = `${process.env.APP_URL || `http://localhost:${PORT}`}/?module=suscripcion`;
      let anySent = false;
      for (const user of orgUsers) {
        if (!user.email) continue;
        const sent = await sendSubscriptionReminderEmail(user.email, org.name, daysLeft, payUrl);
        anySent = anySent || sent;
      }
      if (anySent) {
        await db.systemSettings.setValue(reminderKey, `${today}_${expires}`);
        logger.info({ orgId: org.id, daysLeft }, "Subscription reminder emails sent");
      } else {
        logger.warn({ orgId: org.id }, "SMTP not configured — subscription reminder not sent");
      }
    }
  } catch (err) {
    logger.error({ err }, "Subscription reminder scheduler error");
  }
}

function scheduleSubscriptionReminders(): void {
  runSubscriptionReminders();
  setInterval(() => {
    runSubscriptionReminders();
  }, REMINDER_INTERVAL_MS);
}

if (!process.env.VERCEL) {
  startServer();
}
