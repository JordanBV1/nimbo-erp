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
import { sendPasswordResetEmail } from "./src/mailer.js";

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
    const branch = db.branches.findById(req.user.branchId);
    if (!branch) {
      return res.status(404).json({ error: "Sucursal no encontrada" });
    }
    const org = db.organizations.findById(branch.organizationId);
    if (!org) {
      return res.status(404).json({ error: "Organización no encontrada" });
    }
    req.org = org;
    req.orgId = org.id;
    next();
  } catch (e) {
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
    db.organizations.update(req.org.id, { subscriptionStatus: "expired" });
    return res.status(402).json({ error: "Suscripción vencida. Renueva tu plan para continuar." });
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
    db.auditLogs.create({ userId, action, entity, entityId, changes });
  } catch (e) {
    logger.error({ err: e }, "Audit logging failed");
  }
}

function isBranchInOrg(branchId: string, orgId: string): boolean {
  const branch = db.branches.findById(branchId);
  return !!branch && branch.organizationId === orgId;
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

async function startServer() {
  const app = express();

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
    initializeDatabase();
  } catch (err) {
    logger.error({ err }, "Database initialization failed");
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    let dbOk = false;
    let dbError: string | null = null;
    try {
      dbOk = (db.organizations.findMany().length >= 0);
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

  // --- Auth Routes ---

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { email, password } = parsed.data;

    const user = db.users.findByEmail(email);
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

    const branch = db.branches.findById(user.branchId);
    const org = branch ? db.organizations.findById(branch.organizationId) : null;

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

    const existing = db.users.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "El correo electrónico ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const org = db.organizations.create({ name: orgName });
    const branch = db.branches.create({
      organizationId: org.id,
      name: branchName,
      address: "Dirección de registro",
      businessType: businessType || BusinessType.GENERAL,
    });
    const user = db.users.create({
      name: userName,
      email,
      password: hashedPassword,
      role: Role.ADMIN,
      branchId: branch.id,
    });

    db.warehouses.create({
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

  app.post("/api/auth/logout", (_req, res) => {
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
    const user = db.users.findByEmail(email);

    // Always respond the same way to avoid user enumeration
    if (!user) {
      return res.json({ success: true, message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.passwordResetTokens.invalidateForUser(user.id);
    db.passwordResetTokens.create({ userId: user.id, token, expiresAt, used: false });

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

    const user = db.users.findMany().find((u: any) => {
      const valid = db.passwordResetTokens.findValid(u.id, token);
      return !!valid;
    });

    if (!user) {
      return res.status(400).json({ error: "Enlace inválido o expirado. Solicita uno nuevo." });
    }

    const valid = db.passwordResetTokens.findValid(user.id, token);
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    db.users.update(user.id, { password: hashed });
    db.passwordResetTokens.markUsed(valid.id);
    db.passwordResetTokens.invalidateForUser(user.id);
    logAudit(user.id, "PASSWORD_RESET", "User", user.id);

    return res.json({ success: true, message: "Contraseña restablecida correctamente. Ya puedes iniciar sesión." });
  });

  app.get("/api/auth/me", authenticate, (req, res) => {
    const user = db.users.findById(req.user!.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const { password: _pw, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.get("/api/auth/organization", authenticate, (req, res) => {
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId es requerido" });
    }
    const org = db.organizations.findById(orgId as string);
    if (!org) {
      return res.status(404).json({ error: "Organización no encontrada" });
    }
    const orgBranchIds = new Set(db.branches.findMany().filter((b: any) => b.organizationId === org.id).map((b: any) => b.id));
    if (!orgBranchIds.has(req.user!.branchId)) {
      return res.status(403).json({ error: "No tienes acceso a esta organización" });
    }
    return res.json(org);
  });

  app.get("/api/branches", authenticate, (req, res) => {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId es requerido" });
    const orgBranchIds = new Set(db.branches.findMany().filter((b: any) => b.organizationId === orgId).map((b: any) => b.id));
    if (!orgBranchIds.has(req.user!.branchId)) {
      return res.status(403).json({ error: "No tienes acceso a esta organización" });
    }
    const all = db.branches.findMany();
    const filtered = all.filter((b: any) => b.organizationId === orgId);
    return res.json(filtered);
  });

  // --- Subscription Routes ---

  app.get("/api/subscription/payments", authenticate, (req, res) => {
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId es requerido" });
    }
    try {
      const allPayments = db.subscriptionPayments.findMany();
      const orgPayments = allPayments.filter(p => p.organizationId === orgId);
      orgPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return res.json(orgPayments);
    } catch (e) {
      logger.error({ err: e }, "Failed to fetch subscription payments");
      return res.status(500).json({ error: "Fallo al obtener el historial de pagos" });
    }
  });

  app.post("/api/subscription/pay", authenticate, async (req, res) => {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { orgId, platform, phone, transactionId, amount, userId } = parsed.data;

    const org = db.organizations.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organización no encontrada" });
    }

    const orgBranchIds = new Set(db.branches.findMany().filter((b: any) => b.organizationId === orgId).map((b: any) => b.id));
    if (!orgBranchIds.has(req.user!.branchId)) {
      return res.status(403).json({ error: "No puedes pagar por una organización que no es tuya" });
    }

    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    const updatedOrg = db.organizations.update(orgId, {
      subscriptionStatus: "active",
      subscriptionExpiresAt: expires.toISOString(),
      lastPaymentDate: new Date().toISOString(),
      paymentPlatform: platform,
      paymentPhone: phone || "",
      paymentTxId: transactionId,
    });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "PAY_SUBSCRIPTION", "Organization", orgId, `Paid ${amount} CUP via ${platform} with TxId: ${transactionId}`);

    try {
      db.subscriptionPayments.create({
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
      const trans = db.cashRegisterTransactions.create({
        amount: Number(amount),
        type: "income",
        currency: Currency.CUP,
        description: `Pago mensual suscripción Nimbo ERP: Org ${org.name} (Plataforma: ${platform}, Ref: ${transactionId})`,
        category: "Suscripciones",
        userId: auditUserId,
      });
      db.journalEntries.create({
        description: `Ingreso por Suscripción mensual ERP: ${org.name}`,
        reference: trans.id,
        status: "posted",
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to log subscription to journal");
    }

    return res.json({
      success: true,
      message: "Pago registrado con éxito. Suscripción renovada por 30 días.",
      organization: updatedOrg,
    });
  });

  // --- Products ---

  app.get("/api/products", authSub, (req, res) => {
    const productsList = db.products.findManyByOrg(req.orgId!);
    const variantsList = db.variants.findManyByOrg(req.orgId!);
    const categoriesList = db.categories.findManyByOrg(req.orgId!);
    const taxesList = db.taxes.findManyByOrg(req.orgId!);

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

    const prod = db.products.create({
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
      variants.forEach((v: any) => {
        db.variants.create({
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
      });
    }

    const warehouses = db.warehouses.findManyByOrg(req.orgId!);
    warehouses.forEach((w) => {
      if (variants && Array.isArray(variants) && variants.length > 0) {
        const freshVars = db.variants.findByProductId(prod.id);
        freshVars.forEach((fv) => {
          db.stocks.create({
            productId: prod.id,
            variantId: fv.id,
            warehouseId: w.id,
            quantity: fv.stock,
            minStock: 5,
            maxStock: 9999,
            organizationId: req.orgId!,
          });
        });
      } else {
        db.stocks.create({
          productId: prod.id,
          warehouseId: w.id,
          quantity: 0,
          minStock: 5,
          maxStock: 9999,
          organizationId: req.orgId!,
        });
      }
    });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "CREATE", "Product", prod.id, `Created product ${name}`);

    return res.json(prod);
  });

  app.put("/api/products/:id", authSub, (req, res) => {
    const { id } = req.params;
    const {
      name, description, sku, barcode, unitOfMeasure, isService,
      categoryId, taxId, priceCUP, priceUSD, costCUP, costUSD, imageUrl, variants, userId
    } = req.body;

    const updated = db.products.update(id, {
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
      db.variants.deleteByProductId(id);
      variants.forEach((v: any) => {
        db.variants.create({
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
      });
    }

    const auditUserId = userId || req.user?.userId;
    if (auditUserId) {
      logAudit(auditUserId, "UPDATE", "Product", id, `Updated product ${name}`);
    }

    return res.json(updated);
  });

  // --- Categories ---

  app.get("/api/categories", authSub, (req, res) => {
    return res.json(db.categories.findManyByOrg(req.orgId!));
  });

  app.post("/api/categories", authSub, (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: "Nombre es requerido" });
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const item = db.categories.create({ name, slug, parentId, organizationId: req.orgId! });
    logAudit(req.body.userId || "sistema", "CREATE", "Category", item.id, `Created category ${name}`);
    return res.json(item);
  });

  // --- Inventory ---

  app.get("/api/inventario", authSub, (req, res) => {
    const stocks = db.stocks.findManyByOrg(req.orgId!);
    const products = db.products.findManyByOrg(req.orgId!);
    const variants = db.variants.findManyByOrg(req.orgId!);
    const warehouses = db.warehouses.findManyByOrg(req.orgId!);

    const detailedStocks = stocks.map((s) => {
      const p = products.find((x) => x.id === s.productId);
      const v = s.variantId ? variants.find((x) => x.id === s.variantId) : null;
      const w = warehouses.find((x) => x.id === s.warehouseId);
      return { ...s, product: p, variant: v, warehouse: w };
    });

    return res.json({
      stocks: detailedStocks,
      warehouses,
      movements: db.stockMovements.findMany().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50),
      transfers: db.transfers.findMany().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  });

  app.post("/api/inventario/movimiento", authSub, (req, res) => {
    const { stockId, type, quantity, reason, userId } = req.body;
    if (!stockId || !type || quantity === undefined) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const stocksList = db.stocks.findMany();
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

    db.stocks.update(stockId, { quantity: Math.max(0, finalQty) });

    const mov = db.stockMovements.create({
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

  app.post("/api/inventario/transferencia", authSub, (req, res) => {
    const { fromWarehouseId, toWarehouseId, items, userId } = req.body;
    if (!fromWarehouseId || !toWarehouseId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }

    const transfer = db.transfers.create({
      fromWarehouseId,
      toWarehouseId,
      status: "completada",
      items,
      createdBy: userId || req.user!.userId,
    });

    const stocks = db.stocks.findMany();

    items.forEach((item: any) => {
      const srcStock = stocks.find(
        (s) => s.warehouseId === fromWarehouseId && s.productId === item.productId && s.variantId === item.variantId
      );
      let destStock = stocks.find(
        (s) => s.warehouseId === toWarehouseId && s.productId === item.productId && s.variantId === item.variantId
      );
      const qty = Number(item.quantity);

      if (srcStock) {
        db.stocks.update(srcStock.id, { quantity: Math.max(0, srcStock.quantity - qty) });
        db.stockMovements.create({
          stockId: srcStock.id,
          type: "transferencia",
          quantity: qty,
          reason: `Transferencia enviada a almacén ${toWarehouseId}`,
          userId: userId || req.user!.userId,
        });
      }

      if (!destStock) {
        destStock = db.stocks.create({
          productId: item.productId,
          variantId: item.variantId,
          warehouseId: toWarehouseId,
          quantity: 0,
          minStock: 5,
          maxStock: 9999,
        });
      }

      db.stocks.update(destStock.id, { quantity: destStock.quantity + qty });
      db.stockMovements.create({
        stockId: destStock.id,
        type: "transferencia",
        quantity: qty,
        reason: `Transferencia recibida de almacén ${fromWarehouseId}`,
        userId: userId || req.user!.userId,
      });
    });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "TRANSFER", "Warehouse", fromWarehouseId, `Transferred items to warehouse ${toWarehouseId}`);

    return res.json(transfer);
  });

  // --- POS ---

  app.get("/api/pos/sessions", authSub, (req, res) => {
    const sessions = db.cashRegisterSessions.findManyByOrg(req.orgId!);
    return res.json(sessions);
  });

  app.post("/api/pos/sessions/start", authSub, (req, res) => {
    const { branchId, initialCash, userId } = req.body;
    if (!isBranchInOrg(branchId, req.orgId!)) {
      return res.status(403).json({ error: "La sucursal especificada no pertenece a tu organización" });
    }
    const session = db.cashRegisterSessions.create({
      branchId,
      userId: userId || req.user!.userId,
      initialCash: Number(initialCash) || 0,
      status: "open",
      organizationId: req.orgId!,
    });
    return res.json(session);
  });

  app.post("/api/pos/sessions/close", authSub, (req, res) => {
    const { sessionId, countedCash, expectedCash } = req.body;
    const session = db.cashRegisterSessions.update(sessionId, {
      status: "closed",
      endDate: new Date().toISOString(),
      countedCash: Number(countedCash) || 0,
      expectedCash: Number(expectedCash) || 0,
    });
    return res.json(session);
  });

  // --- Sales ---

  app.get("/api/sales", authSub, (req, res) => {
    const sales = db.sales.findManyByOrg(req.orgId!);
    const customers = db.customers.findManyByOrg(req.orgId!);
    const detailed = sales.map((s) => ({
      ...s,
      customer: customers.find((c) => c.id === s.customerId) || null,
      items: db.saleItems.findMany().filter((i) => i.saleId === s.id),
    }));
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

    if (!isBranchInOrg(branchId, req.orgId!)) {
      return res.status(403).json({ error: "La sucursal especificada no pertenece a tu organización" });
    }

    const sale = db.sales.create({
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

    const stocks = db.stocks.findManyByOrg(req.orgId!);
    const branchWarehouse = db.warehouses.findManyByOrg(req.orgId!).find((w) => w.branchId === branchId);

    items.forEach((item: any) => {
      db.saleItems.create({
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
          db.stocks.update(matchingStock.id, { quantity: Math.max(0, matchingStock.quantity - Number(item.quantity)) });
          db.stockMovements.create({
            stockId: matchingStock.id,
            type: "salida",
            quantity: Number(item.quantity),
            reason: `Venta POS ${sale.id}`,
            userId: userId || req.user!.userId,
            organizationId: req.orgId!,
          });
        }
      }
    });

    if (payments && Array.isArray(payments)) {
      payments.forEach((p: any) => {
        db.payments.create({
          saleId: sale.id,
          method: p.method || paymentMethod,
          currency: p.currency || Currency.CUP,
          amount: Number(p.amount),
          reference: p.reference || undefined,
        });
      });
    } else {
      db.payments.create({
        saleId: sale.id,
        method: paymentMethod || "efectivo",
        currency: (grandTotalUSD || 0) > 0 ? Currency.USD : Currency.CUP,
        amount: (grandTotalUSD || 0) > 0 ? (grandTotalUSD || 0) : (grandTotalCUP || 0),
        reference: paymentMethod !== "efectivo" ? `REF-${Math.floor(Math.random() * 900000) + 100000}` : undefined,
      });
    }

    if (customerId) {
      const customer = db.customers.findById(customerId);
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
        db.customers.update(customerId, { currentBalance: newBalance, loyaltyPoints: newPoints });
      }
    }

    const entry = db.journalEntries.create({
      description: `Ingreso por Venta POS ${sale.id}`,
      reference: sale.id,
      status: "posted",
      organizationId: req.orgId!,
    });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: Number(grandTotalCUP) || 0, credit: 0 });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: 0, credit: Number(grandTotalCUP) || 0 });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "CREATE_SALE", "Sale", sale.id, `Completed sale of ${grandTotalCUP} CUP`);

    return res.json(sale);
  });

  app.post("/api/sales/:id/refund", authSub, (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const sale = db.sales.findById(id);
    if (!sale) return res.status(404).json({ error: "Venta no encontrada" });

    db.sales.update(id, { status: "refunded" });

    const items = db.saleItems.findMany().filter((i) => i.saleId === id);
    const branchWarehouse = db.warehouses.findManyByOrg(req.orgId!).find((w) => w.branchId === sale.branchId);
    const stocks = db.stocks.findManyByOrg(req.orgId!);

    if (branchWarehouse) {
      items.forEach((item) => {
        const matchingStock = stocks.find(
          (s) => s.warehouseId === branchWarehouse.id && s.productId === item.productId && (!item.variantId || s.variantId === item.variantId)
        );
        if (matchingStock) {
          db.stocks.update(matchingStock.id, { quantity: matchingStock.quantity + item.quantity });
          db.stockMovements.create({
            stockId: matchingStock.id,
            type: "entrada",
            quantity: item.quantity,
            reason: `Devolución Venta ${id}`,
            userId: userId || req.user!.userId,
            organizationId: req.orgId!,
          });
        }
      });
    }

    const entry = db.journalEntries.create({
      description: `Reverso de Venta ${id}`,
      reference: id,
      status: "posted",
      organizationId: req.orgId!,
    });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: Number(sale.grandTotalCUP), credit: 0 });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: Number(sale.grandTotalCUP) });

    const auditUserId = userId || req.user?.userId;
    if (auditUserId) {
      logAudit(auditUserId, "REFUND_SALE", "Sale", id, `Refunded sale ${id}`);
    }

    return res.json({ success: true });
  });

  // --- Orders ---

  app.get("/api/orders", authSub, (req, res) => {
    const orders = db.orders.findManyByOrg(req.orgId!);
    const customers = db.customers.findManyByOrg(req.orgId!);
    const detailed = orders.map((o) => ({
      ...o,
      customer: customers.find((c) => c.id === o.customerId) || null,
      items: db.orderItems.findMany().filter((i) => i.orderId === o.id),
    }));
    return res.json(detailed);
  });

  app.post("/api/orders", authSub, (req, res) => {
    const { branchId, customerId, items, deliveryDate, totalCUP, totalUSD, notes, deliveryAddress, assignedDriverId, advancePayment } = req.body;
    if (!isBranchInOrg(branchId, req.orgId!)) {
      return res.status(403).json({ error: "La sucursal especificada no pertenece a tu organización" });
    }
    const order = db.orders.create({
      branchId, customerId, deliveryDate, status: "pending",
      totalCUP: Number(totalCUP) || 0, totalUSD: Number(totalUSD) || 0,
      notes: notes || "", deliveryAddress: deliveryAddress || "",
      assignedDriverId: assignedDriverId || "", advancePayment: Number(advancePayment) || 0,
      organizationId: req.orgId!,
    });
    if (items && Array.isArray(items)) {
      items.forEach((item: any) => {
        db.orderItems.create({
          orderId: order.id, productId: item.productId, variantId: item.variantId || undefined,
          quantity: Number(item.quantity), unitPriceCUP: Number(item.priceCUP) || 0, unitPriceUSD: Number(item.priceUSD) || 0,
        });
      });
    }
    const auditUserId = req.body.userId || req.user!.userId;
    logAudit(auditUserId, "CREATE_ORDER", "Order", order.id, `Created order for ${totalCUP} CUP`);
    return res.json(order);
  });

  app.put("/api/orders/:id/status", authSub, (req, res) => {
    const { id } = req.params;
    const { status, assignedDriverId } = req.body;
    const order = db.orders.update(id, { status, assignedDriverId });
    logAudit(req.body.userId || req.user!.userId, "UPDATE_ORDER_STATUS", "Order", id, `Status changed to ${status}`);
    return res.json(order);
  });

  // --- Purchases ---

  app.get("/api/compras", authSub, (req, res) => {
    const suppliers = db.suppliers.findManyByOrg(req.orgId!);
    const purchaseOrders = db.purchaseOrders.findManyByOrg(req.orgId!);
    const items = db.purchaseOrderItems.findMany();
    const invoices = db.supplierInvoices.findManyByOrg(req.orgId!);
    const products = db.products.findManyByOrg(req.orgId!);

    const detailedOrders = purchaseOrders.map((po) => {
      const sup = suppliers.find((s) => s.id === po.supplierId);
      const poItems = items.filter((i) => i.purchaseOrderId === po.id).map((i) => ({ ...i, product: products.find((p) => p.id === i.productId) }));
      return { ...po, supplier: sup, items: poItems };
    });

    const detailedInvoices = invoices.map((inv) => ({ ...inv, supplier: suppliers.find((s) => s.id === inv.supplierId) }));

    return res.json({ suppliers, purchaseOrders: detailedOrders, invoices: detailedInvoices });
  });

  app.post("/api/compras/suppliers", authSub, (req, res) => {
    const { name, contact, taxId, email, phone, address, paymentTerms } = req.body;
    const item = db.suppliers.create({ name, contact, taxId, email, phone, address, paymentTerms, organizationId: req.orgId! });
    logAudit(req.body.userId || req.user!.userId, "CREATE", "Supplier", item.id, `Created supplier ${name}`);
    return res.json(item);
  });

  app.post("/api/compras/orders", authSub, (req, res) => {
    const { supplierId, warehouseId, notes, createdBy, items } = req.body;
    const po = db.purchaseOrders.create({
      supplierId, warehouseId, status: "draft", notes,
      orderDate: new Date().toISOString().substring(0, 10),
      createdBy: createdBy || "admin",
      organizationId: req.orgId!,
    });
    if (items && Array.isArray(items)) {
      items.forEach((item: any) => {
        db.purchaseOrderItems.create({
          purchaseOrderId: po.id, productId: item.productId, variantId: item.variantId || undefined,
          quantity: Number(item.quantity), unitCostCUP: Number(item.costCUP) || 0, unitCostUSD: Number(item.costUSD) || 0, receivedQty: 0,
        });
      });
    }
    logAudit(req.body.createdBy || "sistema", "CREATE_PURCHASE_ORDER", "PurchaseOrder", po.id);
    return res.json(po);
  });

  app.post("/api/compras/orders/:id/receive", authSub, (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const po = db.purchaseOrders.update(id, { status: "received" });
    if (!po) return res.status(404).json({ error: "Orden no encontrada" });

    const poItems = db.purchaseOrderItems.findMany().filter((i) => i.purchaseOrderId === id);
    const stocks = db.stocks.findManyByOrg(req.orgId!);
    let totalCUP = 0;
    let totalUSD = 0;

    poItems.forEach((poi) => {
      db.purchaseOrderItems.update(poi.id, { receivedQty: poi.quantity });
      let matchingStock = stocks.find((s) => s.warehouseId === po.warehouseId && s.productId === poi.productId && (!poi.variantId || s.variantId === poi.variantId));
      if (!matchingStock) {
        matchingStock = db.stocks.create({ productId: poi.productId, variantId: poi.variantId, warehouseId: po.warehouseId, quantity: 0, minStock: 5, maxStock: 9999, organizationId: req.orgId! });
      }
      db.stocks.update(matchingStock.id, { quantity: matchingStock.quantity + poi.quantity });
      db.stockMovements.create({ stockId: matchingStock.id, type: "entrada", quantity: poi.quantity, reason: `Recepción Orden Compra ${id}`, userId: userId || req.user!.userId, organizationId: req.orgId! });
      totalCUP += poi.quantity * poi.unitCostCUP;
      totalUSD += poi.quantity * poi.unitCostUSD;
    });

    db.supplierInvoices.create({ supplierId: po.supplierId, purchaseOrderId: po.id, totalCUP, totalUSD, paidAmountCUP: 0, paidAmountUSD: 0, status: "pendiente", organizationId: req.orgId! });

    const entry = db.journalEntries.create({ description: `Recepción Orden de Compra ${id}`, reference: id, status: "posted", organizationId: req.orgId! });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1040", debit: totalCUP, credit: 0 });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "2010", debit: 0, credit: totalCUP });

    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "RECEIVE_PURCHASE", "PurchaseOrder", id, `Received purchase order ${id} with total ${totalCUP} CUP`);

    return res.json(po);
  });

  app.post("/api/compras/invoices/:id/pay", authSub, (req, res) => {
    const { id } = req.params;
    const { amountCUP, amountUSD, userId } = req.body;
    const inv = db.supplierInvoices.findMany().find((x) => x.id === id);
    if (!inv) return res.status(404).json({ error: "Factura no encontrada" });

    const updatedPaidCUP = inv.paidAmountCUP + (Number(amountCUP) || 0);
    const updatedPaidUSD = inv.paidAmountUSD + (Number(amountUSD) || 0);
    const status = (updatedPaidCUP >= inv.totalCUP) ? "pagada" : "pendiente";

    const updated = db.supplierInvoices.update(id, { paidAmountCUP: updatedPaidCUP, paidAmountUSD: updatedPaidUSD, status });

    const entry = db.journalEntries.create({ description: `Pago Factura Proveedor ${id}`, reference: id, status: "posted", organizationId: req.orgId! });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "2010", debit: Number(amountCUP) || 0, credit: 0 });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: Number(amountCUP) || 0 });

    return res.json(updated);
  });

  // --- Customers ---

  app.get("/api/clientes", authSub, (req, res) => {
    return res.json(db.customers.findManyByOrg(req.orgId!));
  });

  app.post("/api/clientes", authSub, (req, res) => {
    const { name, email, phone, address, taxId, creditLimit } = req.body;
    const client = db.customers.create({
      name, email: email || "", phone: phone || "", address: address || "",
      taxId: taxId || "", creditLimit: Number(creditLimit) || 0, currentBalance: 0, loyaltyPoints: 0,
      organizationId: req.orgId!,
    });
    logAudit(req.body.userId || req.user!.userId, "CREATE", "Customer", client.id, `Created customer ${name}`);
    return res.json(client);
  });

  app.put("/api/clientes/:id", authSub, (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address, taxId, creditLimit, loyaltyPoints } = req.body;
    const updated = db.customers.update(id, {
      name, email, phone, address, taxId,
      creditLimit: creditLimit !== undefined ? Number(creditLimit) : undefined,
      loyaltyPoints: loyaltyPoints !== undefined ? Number(loyaltyPoints) : undefined,
    });
    logAudit(req.body.userId || req.user!.userId, "UPDATE", "Customer", id, `Updated customer ${name}`);
    return res.json(updated);
  });

  app.post("/api/clientes/campana", authSub, (req, res) => {
    const { name, message, customerIds } = req.body;
    logAudit(req.user!.userId, "SEND_CAMPAIGN", "Customer", "multiple", `Sent campaign '${name}' to ${customerIds ? customerIds.length : 0} customers. Message: ${message}`);
    return res.json({ success: true, logged: true });
  });

  // --- Production ---

  app.get("/api/produccion", authSub, (req, res) => {
    const recipes = db.recipes.findManyByOrg(req.orgId!);
    const ingredients = db.recipeIngredients.findMany();
    const productionOrders = db.productionOrders.findManyByOrg(req.orgId!);
    const products = db.products.findManyByOrg(req.orgId!);
    const warehouses = db.warehouses.findManyByOrg(req.orgId!);

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

  app.post("/api/produccion/recipes", authSub, (req, res) => {
    const { name, productId, yieldQuantity, yieldUnit, ingredients } = req.body;
    const rec = db.recipes.create({ name, productId, yieldQuantity: Number(yieldQuantity) || 1, yieldUnit: yieldUnit || "pieza", organizationId: req.orgId! });
    if (ingredients && Array.isArray(ingredients)) {
      ingredients.forEach((ing: any) => {
        db.recipeIngredients.create({ recipeId: rec.id, ingredientProductId: ing.ingredientProductId, quantity: Number(ing.quantity), unit: ing.unit || "kg", wastePercent: Number(ing.wastePercent) || 0 });
      });
    }
    logAudit(req.body.userId || "sistema", "CREATE", "Recipe", rec.id, `Created recipe ${name}`);
    return res.json(rec);
  });

  app.delete("/api/produccion/recipes/:id", authSub, authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.PRODUCCION), (req, res) => {
    const { id } = req.params;
    db.recipeIngredients.deleteByRecipeId(id);
    db.recipes.delete(id);
    logAudit(req.body.userId || req.user!.userId, "DELETE", "Recipe", id);
    return res.json({ success: true });
  });

  app.post("/api/produccion/orders", authSub, (req, res) => {
    const { productId, recipeId, plannedQuantity, warehouseId, notes } = req.body;
    const order = db.productionOrders.create({ productId, recipeId: recipeId || undefined, plannedQuantity: Number(plannedQuantity), producedQuantity: 0, status: "planned", warehouseId, notes: notes || "", organizationId: req.orgId! });
    logAudit(req.body.userId || "sistema", "CREATE", "ProductionOrder", order.id, `Planned ${plannedQuantity} units`);
    return res.json(order);
  });

  app.post("/api/produccion/orders/:id/start", authSub, (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const order = db.productionOrders.findManyByOrg(req.orgId!).find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: "Orden de producción no encontrada" });

    db.productionOrders.update(id, { status: "in_progress", startDate: new Date().toISOString() });

    if (order.recipeId) {
      const ingredients = db.recipeIngredients.findMany().filter((i) => i.recipeId === order.recipeId);
      const stocks = db.stocks.findManyByOrg(req.orgId!);
      ingredients.forEach((ing) => {
        const requiredQty = (ing.quantity * order.plannedQuantity) * (1 + ing.wastePercent / 100);
        const matchingStock = stocks.find((s) => s.warehouseId === order.warehouseId && s.productId === ing.ingredientProductId);
        if (matchingStock) {
          db.stocks.update(matchingStock.id, { quantity: Math.max(0, matchingStock.quantity - requiredQty) });
          db.stockMovements.create({ stockId: matchingStock.id, type: "salida", quantity: requiredQty, reason: `Consumo ingredientes Orden Producción ${id}`, userId: userId || req.user!.userId, organizationId: req.orgId! });
        }
      });
    }

    return res.json({ success: true });
  });

  app.post("/api/produccion/orders/:id/complete", authSub, (req, res) => {
    const { id } = req.params;
    const { producedQuantity, userId } = req.body;
    const order = db.productionOrders.findManyByOrg(req.orgId!).find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: "Orden de producción no encontrada" });

    const qty = Number(producedQuantity) || order.plannedQuantity;
    db.productionOrders.update(id, { status: "completed", endDate: new Date().toISOString(), producedQuantity: qty });

    const stocks = db.stocks.findManyByOrg(req.orgId!);
    let finishedStock = stocks.find((s) => s.warehouseId === order.warehouseId && s.productId === order.productId);
    if (!finishedStock) {
      finishedStock = db.stocks.create({ productId: order.productId, warehouseId: order.warehouseId, quantity: 0, minStock: 5, maxStock: 9999, organizationId: req.orgId! });
    }
    db.stocks.update(finishedStock.id, { quantity: finishedStock.quantity + qty });
    db.stockMovements.create({ stockId: finishedStock.id, type: "entrada", quantity: qty, reason: `Producción de orden terminada ${id}`, userId: userId || req.user!.userId, organizationId: req.orgId! });

    return res.json({ success: true });
  });

  // --- Finances ---

  app.get("/api/finanzas", authSub, (req, res) => {
    const accounts = db.accounts.findManyByOrg(req.orgId!);
    const journalEntries = db.journalEntries.findManyByOrg(req.orgId!);
    const lines = db.journalEntryLines.findMany();
    const trans = db.cashRegisterTransactions.findManyByOrg(req.orgId!);

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

  app.post("/api/finanzas/transactions", authSub, authorize(Role.CONTABLE, Role.ADMIN, Role.SUPER_ADMIN), (req, res) => {
    const { type, amount, currency, description, category, userId } = req.body;
    if (!type || !amount) return res.status(400).json({ error: "Campos requeridos vacíos" });

    const trans = db.cashRegisterTransactions.create({
      type, amount: Number(amount), currency: currency || Currency.CUP,
      description: description || "", category: category || "General",
      userId: userId || req.user!.userId,
    });

    const entry = db.journalEntries.create({ description: `Transacción Caja No Operativa: ${description}`, reference: trans.id, status: "posted" });
    const isIncome = type === "income";
    const amt = Number(amount);
    if (isIncome) {
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: amt, credit: 0 });
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: 0, credit: amt });
    } else {
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "5030", debit: amt, credit: 0 });
db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: amt });
    }
    const auditUserId = userId || req.user!.userId;
    logAudit(auditUserId, "CREATE_TRANSACTION", "CashTransaction", trans.id, `${type} ${amount} ${currency} - ${description}`);
    return res.json(trans);
  });

  // --- HR ---

  app.get("/api/rrhh", authSub, (req, res) => {
    const employees = db.employees.findManyByOrg(req.orgId!);
    const attendances = db.attendances.findMany();
    const periods = db.payrollPeriods.findMany();
    const details = db.payrollDetails.findMany();

    const detailedEmployees = employees.map((emp) => ({ ...emp, attendances: attendances.filter((a) => a.employeeId === emp.id) }));
    const detailedPeriods = periods.map((p) => ({
      ...p,
      details: details.filter((d) => d.payrollPeriodId === p.id).map((d) => ({ ...d, employee: employees.find((e) => e.id === d.employeeId) })),
    }));

    return res.json({ employees: detailedEmployees, periods: detailedPeriods });
  });

app.post("/api/rrhh/employees", authSub, (req, res) => {
    const { firstName, lastName, hireDate, baseSalary, paymentType, bankAccount, taxId, socialSecurityNumber } = req.body;
    const emp = db.employees.create({
      firstName, lastName, hireDate: hireDate || new Date().toISOString().substring(0, 10),
      baseSalary: Number(baseSalary) || 0, paymentType: paymentType || "salary",
      bankAccount: bankAccount || "", taxId: taxId || "", socialSecurityNumber: socialSecurityNumber || "",
      vacationDays: 24,
      organizationId: req.orgId!,
    });
    logAudit(req.body.userId || req.user!.userId, "CREATE", "Employee", emp.id, `Created employee ${firstName} ${lastName}`);
    return res.json(emp);
  });

  app.post("/api/rrhh/attendance", authSub, (req, res) => {
    const { employeeId, date, checkIn, checkOut } = req.body;
    const inTime = checkIn ? new Date(`${date}T${checkIn}:00Z`) : null;
    const outTime = checkOut ? new Date(`${date}T${checkOut}:00Z`) : null;
    let hoursWorked = 0;
    if (inTime && outTime) {
      hoursWorked = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
    }
    const att = db.attendances.create({
      employeeId, date,
      checkIn: checkIn ? `${date}T${checkIn}:00.000Z` : undefined,
      checkOut: checkOut ? `${date}T${checkOut}:00.000Z` : undefined,
      hoursWorked: hoursWorked > 0 ? Number(hoursWorked.toFixed(2)) : undefined,
    });
    logAudit(req.body.userId || "sistema", "CREATE", "Attendance", att.id, `Attendance for employee ${employeeId} on ${date}`);
    return res.json(att);
  });

  app.post("/api/rrhh/payroll", authSub, authorize(Role.RRHH, Role.ADMIN, Role.SUPER_ADMIN), (req, res) => {
    const { startDate, endDate, employeeAdjustments } = req.body;
    const period = db.payrollPeriods.create({ startDate, endDate, status: "draft", organizationId: req.orgId! });
    const employees = db.employees.findManyByOrg(req.orgId!);

    employees.forEach((emp) => {
      const adj = employeeAdjustments ? employeeAdjustments[emp.id] : null;
      const base = emp.baseSalary;
      const overtime = adj ? Number(adj.overtime) || 0 : 0;
      const bonuses = adj ? Number(adj.bonuses) || 0 : 0;
      const deductions = adj ? Number(adj.deductions) || 0 : 0;
      const netPay = base + overtime + bonuses - deductions;

      db.payrollDetails.create({ payrollPeriodId: period.id, employeeId: emp.id, baseAmount: base, overtime, bonuses, deductions, netPay });

      const entry = db.journalEntries.create({ description: `Gasto Nómina Empleado: ${emp.firstName} ${emp.lastName}`, reference: period.id, status: "posted" });
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "5020", debit: netPay, credit: 0 });
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: netPay });
    });
    logAudit(req.user!.userId, "CREATE_PAYROLL", "PayrollPeriod", period.id, `Payroll ${startDate} to ${endDate}`);
    return res.json(period);
  });

  // --- User Management ---

  app.get("/api/users", authSub, (req, res) => {
    const orgBranches = db.branches.findMany().filter((b: any) => b.organizationId === req.orgId!);
    const orgBranchIds = new Set(orgBranches.map((b: any) => b.id));
    const allUsers = db.users.findMany().filter((u: any) => orgBranchIds.has(u.branchId));
    const branches = db.branches.findMany();

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

    const existing = db.users.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Ya existe un usuario registrado con este correo electrónico" });
    }

    let targetBranchId = isAdmin && branchId ? branchId : req.user!.branchId;
    if (targetBranchId && !isBranchInOrg(targetBranchId, req.orgId!)) {
      return res.status(403).json({ error: "La sucursal especificada no pertenece a tu organización" });
    }

    const hashedPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : undefined;

    const newUser = db.users.create({
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

    const existing = db.users.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isAdmin = req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN;
    if (!isAdmin && existing.branchId !== req.user!.branchId) {
      return res.status(403).json({ error: "Solo puedes modificar usuarios de tu propia sucursal" });
    }

    if (email && email.toLowerCase() !== existing.email.toLowerCase()) {
      const other = db.users.findByEmail(email);
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

    const updatedUser = db.users.update(id, updateData);
    logAudit(req.user!.userId, "UPDATE_USER", "User", id, `Usuario ${updatedUser?.name} actualizado`);
    return res.json({ success: true, user: { ...updatedUser, password: undefined } });
  });

  app.delete("/api/users/:id", authSub, authorize(Role.ADMIN, Role.SUPER_ADMIN), (req, res) => {
    const { id } = req.params;

    if (id === req.user!.userId) {
      return res.status(400).json({ error: "No puedes eliminar tu propio usuario en sesión activa" });
    }

    const existing = db.users.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isAdmin = req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN;
    if (!isAdmin && existing.branchId !== req.user!.branchId) {
      return res.status(403).json({ error: "Solo puedes eliminar usuarios de tu propia sucursal" });
    }

    db.users.delete(id);
    logAudit(req.user!.userId, "DELETE_USER", "User", id, `Usuario ${existing.name} (${existing.email}) eliminado`);
    return res.json({ success: true });
  });

  // --- Config ---

  app.get("/api/configuracion", authSub, (_req, res) => {
    const settings = db.systemSettings.findMany();
    const logs = db.auditLogs.findMany().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
    return res.json({ settings, logs, users: db.users.findMany() });
  });

  app.post("/api/configuracion", authSub, authorize(Role.ADMIN, Role.SUPER_ADMIN), (req, res) => {
    const { settings, userId } = req.body;
    if (settings && typeof settings === "object") {
      Object.keys(settings).forEach((key) => {
        db.systemSettings.setValue(key, String(settings[key]));
      });
      logAudit(userId || req.user!.userId, "UPDATE_SETTINGS", "SystemSetting", "all", JSON.stringify(settings));
    }
    return res.json({ success: true });
  });

  // --- ONAT Report ---

  app.get("/api/reportes/onat", authSub, (req, res) => {
    const { month, year } = req.query;
    const m = month ? Number(month) : new Date().getMonth() + 1;
    const y = year ? Number(year) : new Date().getFullYear();
    const rate = Number(db.systemSettings.getValue("exchange_rate_usd", "120"));

    const sales = db.sales.findManyByOrg(req.orgId!);
    const inxs = db.cashRegisterTransactions.findManyByOrg(req.orgId!);
    const pDetails = db.payrollDetails.findMany();
    const invoices = db.supplierInvoices.findManyByOrg(req.orgId!);

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

    invoices.forEach((inv) => {
      const po = inv.purchaseOrderId ? db.purchaseOrders.findMany().find((p) => p.id === inv.purchaseOrderId) : null;
      const refDate = po ? po.createdAt : new Date().toISOString();
      if (isTargetMonth(refDate)) {
        const usdConverted = inv.totalUSD * rate;
        reportLines.push({ fecha: refDate.substring(0, 10), concepto: `Compra Proveedor (Factura ${inv.id.substring(0, 8)})`, ingreso: 0, gasto: inv.totalCUP + usdConverted });
      }
    });

    pDetails.forEach((d) => {
      const p = db.payrollPeriods.findMany().find((x) => x.id === d.payrollPeriodId);
      if (p && isTargetMonth(p.startDate)) {
        reportLines.push({ fecha: p.startDate.substring(0, 10), concepto: `Gasto de Salarios - Empleado ID ${d.employeeId.substring(0, 6)}`, ingreso: 0, gasto: d.netPay });
      }
    });

    reportLines.sort((a, b) => a.fecha.localeCompare(b.fecha));

    return res.json({ month: m, year: y, exchangeRate: rate, lines: reportLines });
  });

  // Backup trigger (admin only)
  app.post("/api/backup", authenticate, authorize(Role.SUPER_ADMIN), (req, res) => {
    const dest = createBackup();
    if (!dest) {
      return res.status(500).json({ error: "No se pudo crear el backup" });
    }
    logAudit(req.user!.userId, "BACKUP", "Database", dest);
    return res.json({ success: true, file: dest });
  });

  // --- Vite / Static Serving ---

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    logger.info("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    logger.info("Serving production static files from dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT, nodeEnv: process.env.NODE_ENV }, "Full-Stack ERP/POS server running");
    scheduleBackup();
  });
}

startServer();
