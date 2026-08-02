import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import {
  Role, BusinessType, Currency
} from "../types.js";
import { logger } from "../logger.js";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "db-data", "nimbo.db");

let _sql: Database.Database;

function getDb(): Database.Database {
  if (!_sql) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    _sql = new Database(DB_PATH);
    _sql.pragma("journal_mode = WAL");
    _sql.pragma("foreign_keys = ON");
  }
  return _sql;
}

function firstRow<T>(stmt: Database.Statement, params: any[]): T | null {
  const row = stmt.get(...params) as T | undefined;
  return row ?? null;
}

function allRows<T>(stmt: Database.Statement, params: any[] = []): T[] {
  return stmt.all(...params) as T[];
}

function run(stmt: Database.Statement, params: any[]) {
  stmt.run(...params);
}

function generateId(): string {
  return "id_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
}

function ensureTable(createSql: string) {
  getDb().exec(createSql);
}

// --- Dynamic CRUD factory ---
function createCRUD<T extends { id: string }>(tableName: string, extraFields: string = "") {
  const allColumns = "id" + (extraFields ? ", " + extraFields : "");
  ensureTable(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      ${extraFields}
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  return {
    findMany: (): T[] => allRows<T>(getDb().prepare(`SELECT * FROM ${tableName}`)),
    findById: (id: string): T | null => firstRow<T>(getDb().prepare(`SELECT * FROM ${tableName} WHERE id = ?`), [id]),
  };
}

// --- Static schema definition & migration ---
export function initializeDatabase() {
  const sql = getDb();

  sql.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      subscription_status TEXT DEFAULT 'active',
      subscription_expires_at TEXT,
      last_payment_date TEXT,
      payment_platform TEXT,
      payment_phone TEXT,
      payment_tx_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
      name TEXT NOT NULL, address TEXT, business_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT, role TEXT NOT NULL, branch_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT, parent_id TEXT,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS taxes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, rate REAL DEFAULT 0, type TEXT,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, sku TEXT,
      barcode TEXT, unit_of_measure TEXT DEFAULT 'pieza',
      is_service INTEGER DEFAULT 0, category_id TEXT, tax_id TEXT,
      price_cup REAL DEFAULT 0, price_usd REAL DEFAULT 0,
      cost_cup REAL DEFAULT 0, cost_usd REAL DEFAULT 0,
      image_url TEXT,
      organization_id TEXT REFERENCES organizations(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, name TEXT NOT NULL,
      sku TEXT, barcode TEXT, price_cup REAL DEFAULT 0, price_usd REAL DEFAULT 0,
      cost_cup REAL DEFAULT 0, cost_usd REAL DEFAULT 0, stock REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, branch_id TEXT NOT NULL,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS stocks (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, variant_id TEXT,
      warehouse_id TEXT NOT NULL, quantity REAL DEFAULT 0,
      min_stock REAL DEFAULT 5, max_stock REAL DEFAULT 9999,
      lot_number TEXT, expiration_date TEXT
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY, stock_id TEXT NOT NULL, type TEXT NOT NULL,
      quantity REAL DEFAULT 0, reason TEXT, user_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY, from_warehouse_id TEXT NOT NULL,
      to_warehouse_id TEXT NOT NULL, status TEXT DEFAULT 'completada',
      items TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT,
      tax_id TEXT, email TEXT, phone TEXT, address TEXT, payment_terms TEXT,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL, warehouse_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft', order_date TEXT, expected_date TEXT,
      notes TEXT, created_by TEXT,
      organization_id TEXT REFERENCES organizations(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY, purchase_order_id TEXT NOT NULL,
      product_id TEXT NOT NULL, variant_id TEXT,
      quantity REAL DEFAULT 0, unit_cost_cup REAL DEFAULT 0,
      unit_cost_usd REAL DEFAULT 0, received_qty REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS supplier_invoices (
      id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL, purchase_order_id TEXT,
      total_cup REAL DEFAULT 0, total_usd REAL DEFAULT 0, due_date TEXT,
      paid_amount_cup REAL DEFAULT 0, paid_amount_usd REAL DEFAULT 0,
      status TEXT DEFAULT 'pendiente'
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
      address TEXT, tax_id TEXT, credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0, loyalty_points REAL DEFAULT 0,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY, branch_id TEXT NOT NULL, customer_id TEXT,
      date TEXT, total_cup REAL DEFAULT 0, total_usd REAL DEFAULT 0,
      tax_total_cup REAL DEFAULT 0, tax_total_usd REAL DEFAULT 0,
      discount REAL DEFAULT 0, grand_total_cup REAL DEFAULT 0,
      grand_total_usd REAL DEFAULT 0, payment_method TEXT,
      status TEXT DEFAULT 'completed', user_id TEXT,
      organization_id TEXT REFERENCES organizations(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY, sale_id TEXT NOT NULL, product_id TEXT NOT NULL,
      variant_id TEXT, quantity REAL DEFAULT 0, unit_price_cup REAL DEFAULT 0,
      unit_price_usd REAL DEFAULT 0, tax REAL DEFAULT 0, discount REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, sale_id TEXT NOT NULL, method TEXT NOT NULL,
      currency TEXT DEFAULT 'CUP', amount REAL DEFAULT 0, reference TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cash_register_sessions (
      id TEXT PRIMARY KEY, branch_id TEXT NOT NULL, user_id TEXT,
      start_date TEXT, end_date TEXT, initial_cash REAL DEFAULT 0,
      expected_cash REAL, counted_cash REAL, status TEXT DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, branch_id TEXT NOT NULL, customer_id TEXT,
      order_date TEXT, delivery_date TEXT, status TEXT DEFAULT 'pending',
      total_cup REAL DEFAULT 0, total_usd REAL DEFAULT 0,
      notes TEXT, delivery_address TEXT, assigned_driver_id TEXT,
      advance_payment REAL DEFAULT 0,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      variant_id TEXT, quantity REAL DEFAULT 0,
      unit_price_cup REAL DEFAULT 0, unit_price_usd REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, product_id TEXT NOT NULL,
      yield_quantity REAL DEFAULT 1, yield_unit TEXT DEFAULT 'pieza',
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL,
      ingredient_product_id TEXT NOT NULL, quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'kg', waste_percent REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS production_orders (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, recipe_id TEXT,
      planned_quantity REAL DEFAULT 0, produced_quantity REAL DEFAULT 0,
      status TEXT DEFAULT 'planned', start_date TEXT, end_date TEXT,
      warehouse_id TEXT, notes TEXT,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, code TEXT, name TEXT NOT NULL, type TEXT NOT NULL,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY, date TEXT DEFAULT (datetime('now')),
      description TEXT, reference TEXT, status TEXT DEFAULT 'draft',
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS journal_entry_lines (
      id TEXT PRIMARY KEY, journal_entry_id TEXT NOT NULL,
      account_id TEXT NOT NULL, debit REAL DEFAULT 0, credit REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS cash_register_transactions (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'CUP', description TEXT, category TEXT,
      date TEXT DEFAULT (datetime('now')), user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      hire_date TEXT, base_salary REAL DEFAULT 0,
      payment_type TEXT DEFAULT 'salary', bank_account TEXT,
      tax_id TEXT, social_security_number TEXT, vacation_days REAL DEFAULT 24,
      organization_id TEXT REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS attendances (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, date TEXT,
      check_in TEXT, check_out TEXT, hours_worked REAL
    );
    CREATE TABLE IF NOT EXISTS payroll_periods (
      id TEXT PRIMARY KEY, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      status TEXT DEFAULT 'draft'
    );
    CREATE TABLE IF NOT EXISTS payroll_details (
      id TEXT PRIMARY KEY, payroll_period_id TEXT NOT NULL,
      employee_id TEXT NOT NULL, base_amount REAL DEFAULT 0,
      overtime REAL DEFAULT 0, bonuses REAL DEFAULT 0,
      deductions REAL DEFAULT 0, net_pay REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL,
      entity TEXT, entity_id TEXT, changes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT
    );
    CREATE TABLE IF NOT EXISTS subscription_payments (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
      amount REAL DEFAULT 0, currency TEXT DEFAULT 'CUP',
      platform TEXT, phone TEXT, transaction_id TEXT,
      status TEXT DEFAULT 'pending', date TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      token TEXT NOT NULL, expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      user_name TEXT, user_email TEXT, organization_id TEXT,
      subject TEXT NOT NULL, message TEXT NOT NULL,
      status TEXT DEFAULT 'open', created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // --- Migration: add organization_id to existing tables ---
  const orgTables = ["categories", "taxes", "products", "suppliers", "purchase_orders", "customers", "warehouses", "sales", "orders", "recipes", "production_orders", "accounts", "journal_entries", "employees", "variants", "stocks", "stock_movements", "transfers", "supplier_invoices", "cash_register_sessions", "cash_register_transactions", "attendances", "payroll_periods"];
  for (const t of orgTables) {
    try { sql.exec(`ALTER TABLE ${t} ADD COLUMN organization_id TEXT REFERENCES organizations(id)`); } catch {}
  }

  // --- Migration: backfill organization_id for existing rows ---
  // 1) Branch-linked tables: resolve org through branch_id
  try {
    sql.exec(`
      UPDATE warehouses SET organization_id = (SELECT b.organization_id FROM branches b WHERE b.id = warehouses.branch_id)
      WHERE organization_id IS NULL
    `);
    sql.exec(`
      UPDATE sales SET organization_id = (SELECT b.organization_id FROM branches b WHERE b.id = sales.branch_id)
      WHERE organization_id IS NULL
    `);
    sql.exec(`
      UPDATE orders SET organization_id = (SELECT b.organization_id FROM branches b WHERE b.id = orders.branch_id)
      WHERE organization_id IS NULL
    `);
    sql.exec(`
      UPDATE cash_register_sessions SET organization_id = (SELECT b.organization_id FROM branches b WHERE b.id = cash_register_sessions.branch_id)
      WHERE organization_id IS NULL
    `);
  } catch {}

  // 2) Single-org fallback: if the DB has exactly one organization, assign it to everything else
  try {
    const orgCount = (sql.prepare("SELECT COUNT(*) as c FROM organizations").get() as any).c;
    if (orgCount === 1) {
      const singleOrg = (sql.prepare("SELECT id FROM organizations LIMIT 1").get() as any).id;
      for (const t of orgTables) {
        sql.exec(`UPDATE ${t} SET organization_id = '${singleOrg}' WHERE organization_id IS NULL`);
      }
    }
  } catch {}

  const count = (sql.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
  if (count > 0) {
    logger.info("Database already initialized.");
    return;
  }

  logger.info("Seeding initial database...");

  const SALT_ROUNDS = 10;
  const hashSync = (pw: string) => bcrypt.hashSync(pw, SALT_ROUNDS);
  const demoPass = hashSync("123456");
  const now = new Date().toISOString();

  // Helper seed functions
  const insert = (table: string, data: Record<string, any>) => {
    const keys = Object.keys(data);
    const values = keys.map(k => data[k]);
    const cols = keys.join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    sql.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`).run(...values);
    return data;
  };

  const orgId = "org_001";
  insert("organizations", {
    id: orgId, name: "Nimbo ERP",
    subscription_status: "active",
    subscription_expires_at: new Date(Date.now() + 365*86400000).toISOString(),
    created_at: now, updated_at: now,
  });

  insert("subscription_payments", {
    id: generateId(), organization_id: orgId,
    amount: 1000, currency: "CUP", platform: "transfermovil",
    phone: "+53 51234567", transaction_id: "TX-4827104",
    status: "verified", date: new Date(Date.now() - 60*86400000).toISOString(),
  });
  insert("subscription_payments", {
    id: generateId(), organization_id: orgId,
    amount: 1000, currency: "CUP", platform: "enzona",
    transaction_id: "TX-9281745",
    status: "verified", date: new Date(Date.now() - 30*86400000).toISOString(),
  });

  const bBakery = insert("branches", {
    id: generateId(), organization_id: orgId,
    name: "Panadería Nimbo", address: "Calle 23, Vedado, La Habana",
    business_type: BusinessType.BAKERY, created_at: now, updated_at: now,
  });
  const bClothing = insert("branches", {
    id: generateId(), organization_id: orgId,
    name: "Boutique Nimbo", address: "Bulevar de San Rafael, Centro Habana",
    business_type: BusinessType.CLOTHING, created_at: now, updated_at: now,
  });
  const bWorkshop = insert("branches", {
    id: generateId(), organization_id: orgId,
    name: "Taller Nimbo", address: "Ave. Boyeros, Boyeros, La Habana",
    business_type: BusinessType.WORKSHOP, created_at: now, updated_at: now,
  });
  const bGeneral = insert("branches", {
    id: generateId(), organization_id: orgId,
    name: "Sucursal General", address: "Calle Reina, Centro Habana",
    business_type: BusinessType.GENERAL, created_at: now, updated_at: now,
  });

  insert("system_settings", { id: generateId(), key: "exchange_rate_usd", value: "120" });
  insert("system_settings", { id: generateId(), key: "business_name", value: "Nimbo ERP S.R.L." });
  insert("system_settings", { id: generateId(), key: "business_address", value: "La Habana, Cuba" });
  insert("system_settings", { id: generateId(), key: "transfermovil_phone", value: "+53 51234567" });
  insert("system_settings", { id: generateId(), key: "enzona_user", value: "nimbo.erp" });
  insert("system_settings", { id: generateId(), key: "subscription_base_price", value: "5000" });
  insert("system_settings", { id: generateId(), key: "subscription_per_branch_price", value: "1000" });

  insert("users", { id: generateId(), name: "Administrador Panadería", email: "admin@bakery.com", password: demoPass, role: Role.ADMIN, branch_id: bBakery.id, created_at: now, updated_at: now });
  insert("users", { id: generateId(), name: "Cajero Ropa", email: "cajero@ropa.com", password: demoPass, role: Role.CAJERO, branch_id: bClothing.id, created_at: now, updated_at: now });
  insert("users", { id: generateId(), name: "Gerente Ropa", email: "admin@ropa.com", password: demoPass, role: Role.GERENTE, branch_id: bClothing.id, created_at: now, updated_at: now });
  insert("users", { id: generateId(), name: "Administrador General", email: "admin@nimbo.com", password: demoPass, role: Role.SUPER_ADMIN, branch_id: bGeneral.id, created_at: now, updated_at: now });

  const catAlimentos = insert("categories", { id: generateId(), name: "Alimentos", slug: "alimentos" });
  const catPanes = insert("categories", { id: generateId(), name: "Panes", slug: "panes", parent_id: catAlimentos.id });
  const catDulces = insert("categories", { id: generateId(), name: "Dulces y Pasteles", slug: "dulces", parent_id: catAlimentos.id });
  insert("categories", { id: generateId(), name: "Materias Primas", slug: "materias-primas" });
  insert("categories", { id: generateId(), name: "Moda y Ropa", slug: "moda" });
  insert("categories", { id: generateId(), name: "Muebles", slug: "muebles" });

  const taxIva = insert("taxes", { id: generateId(), name: "IVA 10%", rate: 0.1, type: "IVA" });
  insert("taxes", { id: generateId(), name: "Exento", rate: 0, type: "exento" });

  const whBakery = insert("warehouses", { id: generateId(), name: "Almacén Principal Panadería", branch_id: bBakery.id, address: "Vedado" });
  const whClothing = insert("warehouses", { id: generateId(), name: "Almacén Central Boutique", branch_id: bClothing.id, address: "San Rafael" });
  const whWorkshop = insert("warehouses", { id: generateId(), name: "Almacén Taller", branch_id: bWorkshop.id, address: "Boyeros" });
  const whGeneral = insert("warehouses", { id: generateId(), name: "Almacén Central", branch_id: bGeneral.id, address: "Centro Habana" });

  const pPanSuave = insert("products", { id: generateId(), name: "Pan Suave de Leche", description: "Pan de molde enriquecido con leche fresca", sku: "BAK-PAN-001", barcode: "5901234123", unit_of_measure: "pieza", is_service: 0, category_id: catPanes.id, tax_id: taxIva.id, price_cup: 35, price_usd: 0.3, cost_cup: 15, cost_usd: 0.12, created_at: now, updated_at: now });
  const pPastel = insert("products", { id: generateId(), name: "Pastel de Chocolate", description: "Rico pastel de chocolate de 1 libra", sku: "BAK-PAS-002", barcode: "5901234124", unit_of_measure: "pieza", is_service: 0, category_id: catDulces.id, tax_id: taxIva.id, price_cup: 1200, price_usd: 10, cost_cup: 450, cost_usd: 3.75, created_at: now, updated_at: now });
  const pHarina = insert("products", { id: generateId(), name: "Harina de Trigo", description: "Materia prima para panadería", sku: "MAT-HAR-001", barcode: "", unit_of_measure: "kg", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 0, price_usd: 0, cost_cup: 180, cost_usd: 1.5, created_at: now, updated_at: now });
  const pAzucar = insert("products", { id: generateId(), name: "Azúcar Refinada", description: "Saco de azúcar", sku: "MAT-AZU-002", barcode: "", unit_of_measure: "kg", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 0, price_usd: 0, cost_cup: 150, cost_usd: 1.25, created_at: now, updated_at: now });
  const pLevadura = insert("products", { id: generateId(), name: "Levadura Seca", description: "Levadura instantánea", sku: "MAT-LEV-003", barcode: "", unit_of_measure: "kg", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 0, price_usd: 0, cost_cup: 480, cost_usd: 4, created_at: now, updated_at: now });
  const pCamisa = insert("products", { id: generateId(), name: "Camisa de Lino Nimbo", description: "Camisa de vestir 100% lino cubano", sku: "CLO-CAM-001", barcode: "6901123451", unit_of_measure: "pieza", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 2400, price_usd: 20, cost_cup: 1000, cost_usd: 8.3, created_at: now, updated_at: now });
  const pMesa = insert("products", { id: generateId(), name: "Mesa de Centro Rústica", description: "Mesa de centro fabricada en madera preciosa", sku: "WRK-MES-001", barcode: "", unit_of_measure: "pieza", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 15000, price_usd: 125, cost_cup: 7000, cost_usd: 58.3, created_at: now, updated_at: now });

  const varCamisaM = insert("variants", { id: generateId(), product_id: pCamisa.id, name: "Talla M - Blanco", sku: "CLO-CAM-001-M-W", barcode: "690112345101", price_cup: 2400, price_usd: 20, cost_cup: 1000, cost_usd: 8.3, stock: 25 });
  const varCamisaL = insert("variants", { id: generateId(), product_id: pCamisa.id, name: "Talla L - Blanco", sku: "CLO-CAM-001-L-W", barcode: "690112345102", price_cup: 2500, price_usd: 21, cost_cup: 1050, cost_usd: 8.75, stock: 15 });

  insert("stocks", { id: generateId(), product_id: pPanSuave.id, warehouse_id: whBakery.id, quantity: 150, min_stock: 30, max_stock: 500 });
  insert("stocks", { id: generateId(), product_id: pPastel.id, warehouse_id: whBakery.id, quantity: 15, min_stock: 5, max_stock: 50 });
  insert("stocks", { id: generateId(), product_id: pHarina.id, warehouse_id: whBakery.id, quantity: 500, min_stock: 100, max_stock: 2000 });
  insert("stocks", { id: generateId(), product_id: pAzucar.id, warehouse_id: whBakery.id, quantity: 200, min_stock: 50, max_stock: 1000 });
  insert("stocks", { id: generateId(), product_id: pLevadura.id, warehouse_id: whBakery.id, quantity: 10, min_stock: 2, max_stock: 50 });
  insert("stocks", { id: generateId(), product_id: pCamisa.id, variant_id: varCamisaM.id, warehouse_id: whClothing.id, quantity: 25, min_stock: 5, max_stock: 100 });
  insert("stocks", { id: generateId(), product_id: pCamisa.id, variant_id: varCamisaL.id, warehouse_id: whClothing.id, quantity: 15, min_stock: 5, max_stock: 100 });
  insert("stocks", { id: generateId(), product_id: pMesa.id, warehouse_id: whWorkshop.id, quantity: 3, min_stock: 1, max_stock: 20 });

  insert("suppliers", { id: generateId(), name: "Molinos del Caribe S.A.", contact: "Juan Pérez", tax_id: "ONAT-5012395", email: "juan@molinos.cu", phone: "+53 52839211", address: "Zona Especial de Mariel, Artemisa", payment_terms: "30 días" });
  insert("suppliers", { id: generateId(), name: "Textiles Habana", contact: "Marta Rodríguez", tax_id: "ONAT-1294821", email: "marta@textiles.cu", phone: "+53 78321010", address: "Avenida de Italia, La Habana", payment_terms: "Contado" });

  insert("customers", { id: generateId(), name: "Pedro Domínguez", email: "pedro@gmail.com", phone: "+53 54310212", address: "Calle O, Vedado", credit_limit: 5000, current_balance: 0, loyalty_points: 120 });
  insert("customers", { id: generateId(), name: "María Elena García", email: "maria@nauta.cu", phone: "+53 51102931", address: "Plaza de la Revolución, La Habana", credit_limit: 15000, current_balance: 3200, loyalty_points: 450 });
  insert("customers", { id: generateId(), name: "Cliente Final", email: "", phone: "", address: "", credit_limit: 0, current_balance: 0, loyalty_points: 0 });

  const recPan = insert("recipes", { id: generateId(), name: "Receta Estándar Pan Suave", product_id: pPanSuave.id, yield_quantity: 100, yield_unit: "pieza" });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPan.id, ingredient_product_id: pHarina.id, quantity: 15, unit: "kg", waste_percent: 2 });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPan.id, ingredient_product_id: pAzucar.id, quantity: 1.5, unit: "kg", waste_percent: 0 });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPan.id, ingredient_product_id: pLevadura.id, quantity: 0.3, unit: "kg", waste_percent: 1 });
  const recPastel = insert("recipes", { id: generateId(), name: "Receta Pastel Chocolate 1 Lb", product_id: pPastel.id, yield_quantity: 1, yield_unit: "pieza" });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPastel.id, ingredient_product_id: pHarina.id, quantity: 0.3, unit: "kg", waste_percent: 5 });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPastel.id, ingredient_product_id: pAzucar.id, quantity: 0.2, unit: "kg", waste_percent: 1 });

  const empYusnier = insert("employees", { id: generateId(), first_name: "Yusnier", last_name: "Mesa", hire_date: "2024-01-15", base_salary: 18000, payment_type: "salary", bank_account: "9224123456789012", tax_id: "89110412345", social_security_number: "SS-1294821", vacation_days: 24 });
  const empYadira = insert("employees", { id: generateId(), first_name: "Yadira", last_name: "Valdés", hire_date: "2024-03-01", base_salary: 15000, payment_type: "salary", bank_account: "9224123456789033", tax_id: "91021245678", social_security_number: "SS-2384912", vacation_days: 24 });
  const today = new Date().toISOString().substring(0, 10);
  insert("attendances", { id: generateId(), employee_id: empYusnier.id, date: today, check_in: `${today}T08:00:00.000Z`, check_out: `${today}T17:00:00.000Z`, hours_worked: 8 });
  insert("attendances", { id: generateId(), employee_id: empYadira.id, date: today, check_in: `${today}T08:15:00.000Z`, check_out: `${today}T17:00:00.000Z`, hours_worked: 7.75 });

  const chartAccounts = [
    ["1010", "1010", "Caja Principal CUP", "asset"],
    ["1020", "1020", "Caja Principal USD", "asset"],
    ["1030", "1030", "Cuentas por Cobrar Clientes", "asset"],
    ["1040", "1040", "Inventario de Mercancías", "asset"],
    ["1050", "1050", "Inventario de Materias Primas", "asset"],
    ["2010", "2010", "Cuentas por Pagar Proveedores", "liability"],
    ["3010", "3010", "Capital Social", "equity"],
    ["4010", "4010", "Ingresos por Ventas", "income"],
    ["5010", "5010", "Costo de Ventas", "expense"],
    ["5020", "5020", "Gastos de Salarios", "expense"],
    ["5030", "5030", "Gastos Eléctricos y Operativos", "expense"],
  ];
  for (const [id, code, name, type] of chartAccounts) {
    insert("accounts", { id, code, name, type });
  }

  insert("cash_register_sessions", { id: generateId(), branch_id: bBakery.id, user_id: "admin_bakery_placeholder", initial_cash: 5000, status: "open", start_date: now });

  const sale1 = insert("sales", { id: generateId(), branch_id: bBakery.id, customer_id: "cust_pedro", date: new Date(Date.now() - 86400000).toISOString(), total_cup: 1235, total_usd: 10.3, tax_total_cup: 120, tax_total_usd: 1, discount: 0, grand_total_cup: 1355, grand_total_usd: 11.3, payment_method: "Transfermóvil", status: "completed", user_id: "admin_bakery_placeholder", created_at: now, updated_at: now });
  insert("sale_items", { id: generateId(), sale_id: sale1.id, product_id: pPastel.id, quantity: 1, unit_price_cup: 1200, unit_price_usd: 10, tax: 120, discount: 0 });
  insert("sale_items", { id: generateId(), sale_id: sale1.id, product_id: pPanSuave.id, quantity: 1, unit_price_cup: 35, unit_price_usd: 0.3, tax: 0, discount: 0 });
  insert("payments", { id: generateId(), sale_id: sale1.id, method: "Transfermóvil", currency: "CUP", amount: 1355, reference: "TM-482918" });

  const je1 = insert("journal_entries", { id: generateId(), description: "Venta Factura " + sale1.id, reference: sale1.id, status: "posted", date: now });
  insert("journal_entry_lines", { id: generateId(), journal_entry_id: je1.id, account_id: "1010", debit: 1355, credit: 0 });
  insert("journal_entry_lines", { id: generateId(), journal_entry_id: je1.id, account_id: "4010", debit: 0, credit: 1355 });

  logger.info("Database successfully initialized!");

  // Assign the demo organization to all seeded data
  const seedOrgTables = ["categories", "taxes", "products", "variants", "suppliers", "customers", "recipes", "production_orders", "accounts", "journal_entries", "employees", "stocks", "stock_movements", "transfers", "purchase_orders", "supplier_invoices", "sales", "orders", "cash_register_sessions", "cash_register_transactions", "warehouses"];
  for (const t of seedOrgTables) {
    try { sql.exec(`UPDATE ${t} SET organization_id = '${orgId}' WHERE organization_id IS NULL`); } catch {}
  }
}

// --- Map camelCase JS columns to snake_case SQL columns ---
function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, l => "_" + l.toLowerCase());
}

function toCamel(row: Record<string, any>): any {
  if (!row) return row;
  const result: any = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    result[camelKey] = row[key];
  }
  return result;
}

function rowsToCamel(rows: Record<string, any>[]): any[] {
  return rows.map(toCamel);
}

export const getRawDb = getDb;

// --- Collection-style API (backward compatible) ---
export const db = {
  organizations: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM organizations"))),
    findById: (id: string) => toCamel(firstRow<any>(getDb().prepare("SELECT * FROM organizations WHERE id = ?"), [id])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      getDb().prepare(`INSERT INTO organizations (id, name, subscription_status, subscription_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.name, 'active', expires.toISOString(), now, now);
      return { id, ...data, subscriptionStatus: 'active', subscriptionExpiresAt: expires.toISOString(), createdAt: now, updatedAt: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE organizations SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.organizations.findById(id);
    },
  },
  branches: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM branches"))),
    findById: (id: string) => toCamel(firstRow<any>(getDb().prepare("SELECT * FROM branches WHERE id = ?"), [id])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO branches (id, organization_id, name, address, business_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.organizationId, data.name, data.address || "", data.businessType || "", now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE branches SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.branches.findById(id);
    },
  },
  users: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM users"))),
    findById: (id: string) => toCamel(firstRow<any>(getDb().prepare("SELECT * FROM users WHERE id = ?"), [id])),
    findByEmail: (email: string) => toCamel(firstRow<any>(getDb().prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)"), [email])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO users (id, name, email, password, role, branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.email, data.password || "", data.role, data.branchId, now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE users SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.users.findById(id);
    },
    delete: (id: string) => { getDb().prepare("DELETE FROM users WHERE id = ?").run(id); return true; },
  },
  categories: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM categories"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM categories WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO categories (id, name, slug, parent_id, organization_id) VALUES (?, ?, ?, ?, ?)`).run(id, data.name, data.slug || "", data.parentId || null, data.organizationId || null);
      return { id, ...data };
    },
    delete: (id: string) => { getDb().prepare("DELETE FROM categories WHERE id = ?").run(id); return true; },
  },
  taxes: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM taxes"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM taxes WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO taxes (id, name, rate, type, organization_id) VALUES (?, ?, ?, ?, ?)`).run(id, data.name, data.rate, data.type, data.organizationId || null);
      return { id, ...data };
    },
  },
  products: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM products"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM products WHERE organization_id = ?"), [orgId])),
    findById: (id: string) => toCamel(firstRow<any>(getDb().prepare("SELECT * FROM products WHERE id = ?"), [id])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO products (id, name, description, sku, barcode, unit_of_measure, is_service, category_id, tax_id, price_cup, price_usd, cost_cup, cost_usd, image_url, organization_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.description || "", data.sku || "", data.barcode || "", data.unitOfMeasure || "pieza", data.isService ? 1 : 0, data.categoryId || null, data.taxId || null, data.priceCUP || 0, data.priceUSD || 0, data.costCUP || 0, data.costUSD || 0, data.imageUrl || "", data.organizationId || null, now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (k === 'isService') { sets.push("is_service = ?"); vals.push(v ? 1 : 0); }
        else { sets.push(`${toSnake(k)} = ?`); vals.push(v); }
      }
      vals.push(id);
      getDb().prepare(`UPDATE products SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.products.findById(id);
    },
    delete: (id: string) => { getDb().prepare("DELETE FROM products WHERE id = ?").run(id); return true; },
  },
  variants: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM variants"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM variants WHERE organization_id = ?"), [orgId])),
    findByProductId: (productId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM variants WHERE product_id = ?"), [productId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO variants (id, product_id, name, sku, barcode, price_cup, price_usd, cost_cup, cost_usd, stock, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.productId, data.name, data.sku || "", data.barcode || "", data.priceCUP || 0, data.priceUSD || 0, data.costCUP || 0, data.costUSD || 0, data.stock || 0, data.organizationId || null);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE variants SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      const row = firstRow<any>(getDb().prepare("SELECT * FROM variants WHERE id = ?"), [id]);
      return row ? toCamel(row) : null;
    },
    deleteByProductId: (productId: string) => { getDb().prepare("DELETE FROM variants WHERE product_id = ?").run(productId); },
    delete: (id: string) => { getDb().prepare("DELETE FROM variants WHERE id = ?").run(id); },
  },
  warehouses: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM warehouses"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM warehouses WHERE organization_id = ?"), [orgId])),
    findByBranchId: (branchId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM warehouses WHERE branch_id = ?"), [branchId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO warehouses (id, name, address, branch_id, organization_id) VALUES (?, ?, ?, ?, ?)`).run(id, data.name, data.address || "", data.branchId, data.organizationId || null);
      return { id, ...data };
    },
  },
  stocks: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM stocks"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM stocks WHERE organization_id = ?"), [orgId])),
    findByWarehouseId: (whId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM stocks WHERE warehouse_id = ?"), [whId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO stocks (id, product_id, variant_id, warehouse_id, quantity, min_stock, max_stock, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.productId, data.variantId || null, data.warehouseId, data.quantity || 0, data.minStock || 5, data.maxStock || 9999, data.organizationId || null);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE stocks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      const row = firstRow<any>(getDb().prepare("SELECT * FROM stocks WHERE id = ?"), [id]);
      return row ? toCamel(row) : null;
    },
  },
  stockMovements: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM stock_movements"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM stock_movements WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO stock_movements (id, stock_id, type, quantity, reason, user_id, organization_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.stockId, data.type, data.quantity, data.reason || "", data.userId || "sistema", data.organizationId || null, now);
      return { id, ...data, createdAt: now };
    },
  },
  transfers: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM transfers"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM transfers WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO transfers (id, from_warehouse_id, to_warehouse_id, status, items, created_by, organization_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.fromWarehouseId, data.toWarehouseId, data.status || "completada", JSON.stringify(data.items || []), data.createdBy || "sistema", data.organizationId || null, now);
      return { id, ...data, createdAt: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE transfers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  suppliers: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM suppliers"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM suppliers WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO suppliers (id, name, contact, tax_id, email, phone, address, payment_terms, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.contact || "", data.taxId || "", data.email || "", data.phone || "", data.address || "", data.paymentTerms || "", data.organizationId || null);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE suppliers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  purchaseOrders: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM purchase_orders"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM purchase_orders WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO purchase_orders (id, supplier_id, warehouse_id, status, order_date, notes, created_by, organization_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.supplierId, data.warehouseId, data.status || "draft", data.orderDate || now.substring(0, 10), data.notes || "", data.createdBy || "admin", data.organizationId || null, now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE purchase_orders SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  purchaseOrderItems: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM purchase_order_items"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO purchase_order_items (id, purchase_order_id, product_id, variant_id, quantity, unit_cost_cup, unit_cost_usd, received_qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.purchaseOrderId, data.productId, data.variantId || null, data.quantity || 0, data.unitCostCUP || 0, data.unitCostUSD || 0, data.receivedQty || 0);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE purchase_order_items SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  supplierInvoices: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM supplier_invoices"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM supplier_invoices WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO supplier_invoices (id, supplier_id, purchase_order_id, total_cup, total_usd, paid_amount_cup, paid_amount_usd, status, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.supplierId, data.purchaseOrderId || null, data.totalCUP || 0, data.totalUSD || 0, data.paidAmountCUP || 0, data.paidAmountUSD || 0, data.status || "pendiente", data.organizationId || null);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE supplier_invoices SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  customers: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM customers"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM customers WHERE organization_id = ?"), [orgId])),
    findById: (id: string) => toCamel(firstRow<any>(getDb().prepare("SELECT * FROM customers WHERE id = ?"), [id])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO customers (id, name, email, phone, address, tax_id, credit_limit, current_balance, loyalty_points, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.email || "", data.phone || "", data.address || "", data.taxId || "", data.creditLimit || 0, data.currentBalance || 0, data.loyaltyPoints || 0, data.organizationId || null);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return db.customers.findById(id);
    },
  },
  sales: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM sales"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM sales WHERE organization_id = ?"), [orgId])),
    findById: (id: string) => toCamel(firstRow<any>(getDb().prepare("SELECT * FROM sales WHERE id = ?"), [id])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO sales (id, branch_id, customer_id, date, total_cup, total_usd, tax_total_cup, tax_total_usd, discount, grand_total_cup, grand_total_usd, payment_method, status, user_id, organization_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.branchId, data.customerId || null, data.date || now, data.totalCUP || 0, data.totalUSD || 0, data.taxTotalCUP || 0, data.taxTotalUSD || 0, data.discount || 0, data.grandTotalCUP || 0, data.grandTotalUSD || 0, data.paymentMethod || "efectivo", data.status || "completed", data.userId || "sistema", data.organizationId || null, now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE sales SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.sales.findById(id);
    },
  },
  saleItems: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM sale_items"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO sale_items (id, sale_id, product_id, variant_id, quantity, unit_price_cup, unit_price_usd, tax, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.saleId, data.productId, data.variantId || null, data.quantity || 0, data.unitPriceCUP || 0, data.unitPriceUSD || 0, data.tax || 0, data.discount || 0);
      return { id, ...data };
    },
  },
  payments: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM payments"))),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO payments (id, sale_id, method, currency, amount, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.saleId, data.method, data.currency || "CUP", data.amount || 0, data.reference || null, now);
      return { id, ...data, createdAt: now };
    },
  },
  cashRegisterSessions: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM cash_register_sessions"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM cash_register_sessions WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO cash_register_sessions (id, branch_id, user_id, start_date, initial_cash, status, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.branchId, data.userId || "", now, data.initialCash || 0, data.status || "open", data.organizationId || null);
      return { id, ...data, startDate: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE cash_register_sessions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  orders: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM orders"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM orders WHERE organization_id = ?"), [orgId])),
    findById: (id: string) => toCamel(firstRow<any>(getDb().prepare("SELECT * FROM orders WHERE id = ?"), [id])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO orders (id, branch_id, customer_id, order_date, delivery_date, status, total_cup, total_usd, notes, delivery_address, assigned_driver_id, advance_payment, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.branchId, data.customerId || null, now, data.deliveryDate || null, data.status || "pending", data.totalCUP || 0, data.totalUSD || 0, data.notes || "", data.deliveryAddress || "", data.assignedDriverId || "", data.advancePayment || 0, data.organizationId || null);
      return { id, ...data, orderDate: now };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  orderItems: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM order_items"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO order_items (id, order_id, product_id, variant_id, quantity, unit_price_cup, unit_price_usd) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.orderId, data.productId, data.variantId || null, data.quantity || 0, data.unitPriceCUP || 0, data.unitPriceUSD || 0);
      return { id, ...data };
    },
  },
  recipes: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM recipes"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM recipes WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO recipes (id, name, product_id, yield_quantity, yield_unit, organization_id) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.name, data.productId, data.yieldQuantity || 1, data.yieldUnit || "pieza", data.organizationId || null);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE recipes SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
    delete: (id: string) => { getDb().prepare("DELETE FROM recipes WHERE id = ?").run(id); },
  },
  recipeIngredients: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM recipe_ingredients"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO recipe_ingredients (id, recipe_id, ingredient_product_id, quantity, unit, waste_percent) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.recipeId, data.ingredientProductId, data.quantity || 0, data.unit || "kg", data.wastePercent || 0);
      return { id, ...data };
    },
    deleteByRecipeId: (recipeId: string) => { getDb().prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(recipeId); },
  },
  productionOrders: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM production_orders"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM production_orders WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO production_orders (id, product_id, recipe_id, planned_quantity, produced_quantity, status, warehouse_id, notes, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.productId, data.recipeId || null, data.plannedQuantity || 0, 0, data.status || "planned", data.warehouseId, data.notes || "", data.organizationId || null);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE production_orders SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  accounts: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM accounts"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM accounts WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      getDb().prepare(`INSERT INTO accounts (id, code, name, type, organization_id) VALUES (?, ?, ?, ?, ?)`).run(data.id, data.code, data.name, data.type, data.organizationId || null);
      return data;
    },
  },
  journalEntries: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM journal_entries"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM journal_entries WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO journal_entries (id, description, reference, status, date, organization_id) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.description || "", data.reference || "", data.status || "draft", now, data.organizationId || null);
      return { id, ...data, date: now };
    },
  },
  journalEntryLines: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM journal_entry_lines"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?, ?)`).run(id, data.journalEntryId, data.accountId, data.debit || 0, data.credit || 0);
      return { id, ...data };
    },
  },
  cashRegisterTransactions: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM cash_register_transactions"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM cash_register_transactions WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO cash_register_transactions (id, type, amount, currency, description, category, date, user_id, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.type, data.amount || 0, data.currency || "CUP", data.description || "", data.category || "General", now, data.userId || "sistema", data.organizationId || null);
      return { id, ...data, date: now };
    },
  },
  employees: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM employees"))),
    findManyByOrg: (orgId: string) => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM employees WHERE organization_id = ?"), [orgId])),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO employees (id, first_name, last_name, hire_date, base_salary, payment_type, bank_account, tax_id, social_security_number, vacation_days, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.firstName, data.lastName, data.hireDate || new Date().toISOString().substring(0, 10), data.baseSalary || 0, data.paymentType || "salary", data.bankAccount || "", data.taxId || "", data.socialSecurityNumber || "", data.vacationDays || 24, data.organizationId || null);
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
    delete: (id: string) => { getDb().prepare("DELETE FROM employees WHERE id = ?").run(id); },
  },
  attendances: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM attendances"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO attendances (id, employee_id, date, check_in, check_out, hours_worked) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.employeeId, data.date, data.checkIn || null, data.checkOut || null, data.hoursWorked || null);
      return { id, ...data };
    },
  },
  payrollPeriods: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM payroll_periods"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO payroll_periods (id, start_date, end_date, status) VALUES (?, ?, ?, ?)`).run(id, data.startDate, data.endDate, data.status || "draft");
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE payroll_periods SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  payrollDetails: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM payroll_details"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO payroll_details (id, payroll_period_id, employee_id, base_amount, overtime, bonuses, deductions, net_pay) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.payrollPeriodId, data.employeeId, data.baseAmount || 0, data.overtime || 0, data.bonuses || 0, data.deductions || 0, data.netPay || 0);
      return { id, ...data };
    },
  },
  auditLogs: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM audit_logs"))),
    create: (data: any) => {
      const id = generateId();
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO audit_logs (id, user_id, action, entity, entity_id, changes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.userId, data.action, data.entity, data.entityId || null, data.changes || null, now);
      return { id, ...data, createdAt: now };
    },
  },
  systemSettings: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM system_settings"))),
    getValue: (key: string, defaultVal: string): string => {
      const row = firstRow<any>(getDb().prepare("SELECT value FROM system_settings WHERE key = ?"), [key]);
      return row ? row.value : defaultVal;
    },
    setValue: (key: string, value: string) => {
      const existing = firstRow<any>(getDb().prepare("SELECT id FROM system_settings WHERE key = ?"), [key]);
      if (existing) {
        getDb().prepare("UPDATE system_settings SET value = ? WHERE key = ?").run(value, key);
      } else {
        getDb().prepare("INSERT INTO system_settings (id, key, value) VALUES (?, ?, ?)").run(generateId(), key, value);
      }
    },
  },
  subscriptionPayments: {
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM subscription_payments"))),
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO subscription_payments (id, organization_id, amount, currency, platform, phone, transaction_id, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.organizationId, data.amount || 0, data.currency || "CUP", data.platform, data.phone || "", data.transactionId, data.status || "pending", data.date || new Date().toISOString());
      return { id, ...data };
    },
    update: (id: string, data: any) => {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`); vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE subscription_payments SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
  },
  passwordResetTokens: {
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used) VALUES (?, ?, ?, ?, ?)`).run(id, data.userId, data.token, data.expiresAt, data.used ? 1 : 0);
      return { id, ...data };
    },
    findValid: (userId: string, token: string) => toCamel(firstRow<any>(getDb().prepare(`SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') ORDER BY created_at DESC LIMIT 1`), [userId, token])),
    markUsed: (id: string) => { getDb().prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?").run(id); },
    invalidateForUser: (userId: string) => { getDb().prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?").run(userId); },
  },
  supportTickets: {
    create: (data: any) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO support_tickets (id, user_id, user_name, user_email, organization_id, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.userId, data.userName || "", data.userEmail || "", data.organizationId || "", data.subject, data.message, data.status || "open");
      return { id, ...data, createdAt: new Date().toISOString() };
    },
    findMany: () => rowsToCamel(allRows<any>(getDb().prepare("SELECT * FROM support_tickets ORDER BY created_at DESC"))),
    updateStatus: (id: string, status: string) => { getDb().prepare("UPDATE support_tickets SET status = ? WHERE id = ?").run(status, id); },
  },
};
