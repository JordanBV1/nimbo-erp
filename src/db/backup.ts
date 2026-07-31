import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { logger } from "../logger.js";

const DB_PATH = path.join(process.cwd(), "db-data", "nimbo.db");
const BACKUP_DIR = path.join(process.cwd(), "db-data", "backups");
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKUPS = 7;

export function createBackup(): string | null {
  try {
    if (!fs.existsSync(DB_PATH)) {
      logger.warn("Backup skipped: database file does not exist");
      return null;
    }
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(BACKUP_DIR, `nimbo-${timestamp}.db`);

    const db = new Database(DB_PATH, { readonly: true });
    try {
      db.backup(dest);
    } finally {
      db.close();
    }

    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("nimbo-") && f.endsWith(".db"))
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
  setInterval(createBackup, BACKUP_INTERVAL_MS);
  logger.info({ intervalMs: BACKUP_INTERVAL_MS }, "Backup scheduler started");
}
