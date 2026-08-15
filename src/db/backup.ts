import path from "path";
import fs from "fs";
import type Database from "better-sqlite3";
import { createRequire } from "module";
import { logger } from "../logger.js";
import { USE_PG } from "./db.js";
import { getPool } from "./pg.js";

const DB_BASE = process.env.VERCEL ? path.join("/tmp", "nimbo") : path.join(process.cwd(), "db-data");
const DB_PATH = process.env.DB_PATH || path.join(DB_BASE, "nimbo.db");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DB_BASE, "backups");
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKUPS = 7;

const TABLES = [
  "organizations", "branches", "users", "categories", "taxes", "products", "variants",
  "warehouses", "stocks", "stock_movements", "transfers", "suppliers", "purchase_orders",
  "purchase_order_items", "supplier_invoices", "customers", "sales", "sale_items", "payments",
  "cash_register_sessions", "orders", "order_items", "recipes", "recipe_ingredients",
  "production_orders", "accounts", "journal_entries", "journal_entry_lines",
  "cash_register_transactions", "employees", "attendances", "payroll_periods", "payroll_details",
  "audit_logs", "system_settings", "subscription_payments", "password_reset_tokens", "support_tickets",
];

export async function createBackup(): Promise<string | null> {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = USE_PG ? "json" : "db";
    const dest = path.join(BACKUP_DIR, `nimbo-${timestamp}.${ext}`);

    if (USE_PG) {
      const dump: Record<string, any[]> = {};
      const pool = getPool();
      for (const t of TABLES) {
        try {
          const res = await pool.query(`SELECT * FROM ${t}`);
          dump[t] = res.rows;
        } catch {
          dump[t] = [];
        }
      }
      fs.writeFileSync(dest, JSON.stringify(dump, null, 2), "utf8");
    } else {
      if (!fs.existsSync(DB_PATH)) {
        logger.warn("Backup skipped: database file does not exist");
        return null;
      }
      const lazyRequire = createRequire(
        import.meta.url || path.join(process.cwd(), "server.js"),
      );
      const DatabaseCtor = lazyRequire("better-sqlite3") as typeof Database;
      const db = new DatabaseCtor(DB_PATH, { readonly: true });
      try {
        await db.backup(dest);
      } finally {
        db.close();
      }
    }

    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("nimbo-") && f.endsWith("." + ext))
      .sort();
    while (backups.length > MAX_BACKUPS) {
      const oldest = backups.shift()!;
      fs.unlinkSync(path.join(BACKUP_DIR, oldest));
      logger.info({ file: oldest }, "Removed old backup");
    }

    const stat = fs.statSync(dest);
    logger.info({ file: dest, bytes: stat.size }, "Database backup created");
    return dest;
  } catch (err) {
    logger.error({ err }, "Database backup failed");
    return null;
  }
}

export function scheduleBackup(): void {
  if (process.env.NODE_ENV !== "production") {
    logger.info("Backup scheduler disabled in development");
    return;
  }
  createBackup();
  setInterval(() => {
    createBackup();
  }, BACKUP_INTERVAL_MS);
  logger.info({ intervalMs: BACKUP_INTERVAL_MS }, "Backup scheduler started");
}