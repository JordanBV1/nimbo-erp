"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_helmet = __toESM(require("helmet"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_zod = require("zod");

// src/db/db.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);

// src/types.ts
var BusinessType = /* @__PURE__ */ ((BusinessType2) => {
  BusinessType2["BAKERY"] = "BAKERY";
  BusinessType2["CAFETERIA"] = "CAFETERIA";
  BusinessType2["WORKSHOP"] = "WORKSHOP";
  BusinessType2["CLOTHING"] = "CLOTHING";
  BusinessType2["ELECTRONICS"] = "ELECTRONICS";
  BusinessType2["GROCERY"] = "GROCERY";
  BusinessType2["PHARMACY"] = "PHARMACY";
  BusinessType2["HARDWARE"] = "HARDWARE";
  BusinessType2["BOOKSTORE"] = "BOOKSTORE";
  BusinessType2["HOME_GOODS"] = "HOME_GOODS";
  BusinessType2["BEAUTY"] = "BEAUTY";
  BusinessType2["SERVICES"] = "SERVICES";
  BusinessType2["GENERAL"] = "GENERAL";
  return BusinessType2;
})(BusinessType || {});

// src/db/db.ts
var DB_PATH = import_path.default.join(process.cwd(), "db-data", "nimbo.db");
var _sql;
function getDb() {
  if (!_sql) {
    const dir = import_path.default.dirname(DB_PATH);
    if (!import_fs.default.existsSync(dir)) {
      import_fs.default.mkdirSync(dir, { recursive: true });
    }
    _sql = new import_better_sqlite3.default(DB_PATH);
    _sql.pragma("journal_mode = WAL");
    _sql.pragma("foreign_keys = ON");
  }
  return _sql;
}
function firstRow(stmt, params) {
  const row = stmt.get(...params);
  return row ?? null;
}
function allRows(stmt, params = []) {
  return stmt.all(...params);
}
function generateId() {
  return "id_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
}
function initializeDatabase() {
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
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT, parent_id TEXT
    );
    CREATE TABLE IF NOT EXISTS taxes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, rate REAL DEFAULT 0, type TEXT
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, sku TEXT,
      barcode TEXT, unit_of_measure TEXT DEFAULT 'pieza',
      is_service INTEGER DEFAULT 0, category_id TEXT, tax_id TEXT,
      price_cup REAL DEFAULT 0, price_mlc REAL DEFAULT 0,
      cost_cup REAL DEFAULT 0, cost_mlc REAL DEFAULT 0,
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, name TEXT NOT NULL,
      sku TEXT, barcode TEXT, price_cup REAL DEFAULT 0, price_mlc REAL DEFAULT 0,
      cost_cup REAL DEFAULT 0, cost_mlc REAL DEFAULT 0, stock REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, branch_id TEXT NOT NULL
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
      tax_id TEXT, email TEXT, phone TEXT, address TEXT, payment_terms TEXT
    );
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL, warehouse_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft', order_date TEXT, expected_date TEXT,
      notes TEXT, created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY, purchase_order_id TEXT NOT NULL,
      product_id TEXT NOT NULL, variant_id TEXT,
      quantity REAL DEFAULT 0, unit_cost_cup REAL DEFAULT 0,
      unit_cost_mlc REAL DEFAULT 0, received_qty REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS supplier_invoices (
      id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL, purchase_order_id TEXT,
      total_cup REAL DEFAULT 0, total_mlc REAL DEFAULT 0, due_date TEXT,
      paid_amount_cup REAL DEFAULT 0, paid_amount_mlc REAL DEFAULT 0,
      status TEXT DEFAULT 'pendiente'
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
      address TEXT, tax_id TEXT, credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0, loyalty_points REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY, branch_id TEXT NOT NULL, customer_id TEXT,
      date TEXT, total_cup REAL DEFAULT 0, total_mlc REAL DEFAULT 0,
      tax_total_cup REAL DEFAULT 0, tax_total_mlc REAL DEFAULT 0,
      discount REAL DEFAULT 0, grand_total_cup REAL DEFAULT 0,
      grand_total_mlc REAL DEFAULT 0, payment_method TEXT,
      status TEXT DEFAULT 'completed', user_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY, sale_id TEXT NOT NULL, product_id TEXT NOT NULL,
      variant_id TEXT, quantity REAL DEFAULT 0, unit_price_cup REAL DEFAULT 0,
      unit_price_mlc REAL DEFAULT 0, tax REAL DEFAULT 0, discount REAL DEFAULT 0
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
      total_cup REAL DEFAULT 0, total_mlc REAL DEFAULT 0,
      notes TEXT, delivery_address TEXT, assigned_driver_id TEXT,
      advance_payment REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      variant_id TEXT, quantity REAL DEFAULT 0,
      unit_price_cup REAL DEFAULT 0, unit_price_mlc REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, product_id TEXT NOT NULL,
      yield_quantity REAL DEFAULT 1, yield_unit TEXT DEFAULT 'pieza'
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
      warehouse_id TEXT, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, code TEXT, name TEXT NOT NULL, type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY, date TEXT DEFAULT (datetime('now')),
      description TEXT, reference TEXT, status TEXT DEFAULT 'draft'
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
      tax_id TEXT, social_security_number TEXT, vacation_days REAL DEFAULT 24
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
  `);
  const count = sql.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (count > 0) {
    console.log("Database already initialized.");
    return;
  }
  console.log("Seeding initial database...");
  const SALT_ROUNDS2 = 10;
  const hashSync = (pw) => import_bcryptjs.default.hashSync(pw, SALT_ROUNDS2);
  const demoPass = hashSync("123456");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const insert = (table, data) => {
    const keys = Object.keys(data);
    const values = keys.map((k) => data[k]);
    const cols = keys.join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    sql.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`).run(...values);
    return data;
  };
  const orgId = "org_001";
  insert("organizations", {
    id: orgId,
    name: "Nimbo ERP",
    subscription_status: "active",
    subscription_expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
    created_at: now,
    updated_at: now
  });
  insert("subscription_payments", {
    id: generateId(),
    organization_id: orgId,
    amount: 1e3,
    currency: "CUP",
    platform: "transfermovil",
    phone: "+53 51234567",
    transaction_id: "TX-4827104",
    status: "verified",
    date: new Date(Date.now() - 60 * 864e5).toISOString()
  });
  insert("subscription_payments", {
    id: generateId(),
    organization_id: orgId,
    amount: 1e3,
    currency: "CUP",
    platform: "enzona",
    transaction_id: "TX-9281745",
    status: "verified",
    date: new Date(Date.now() - 30 * 864e5).toISOString()
  });
  const bBakery = insert("branches", {
    id: generateId(),
    organization_id: orgId,
    name: "Panader\xEDa Nimbo",
    address: "Calle 23, Vedado, La Habana",
    business_type: "BAKERY" /* BAKERY */,
    created_at: now,
    updated_at: now
  });
  const bClothing = insert("branches", {
    id: generateId(),
    organization_id: orgId,
    name: "Boutique Nimbo",
    address: "Bulevar de San Rafael, Centro Habana",
    business_type: "CLOTHING" /* CLOTHING */,
    created_at: now,
    updated_at: now
  });
  const bWorkshop = insert("branches", {
    id: generateId(),
    organization_id: orgId,
    name: "Taller Nimbo",
    address: "Ave. Boyeros, Boyeros, La Habana",
    business_type: "WORKSHOP" /* WORKSHOP */,
    created_at: now,
    updated_at: now
  });
  const bGeneral = insert("branches", {
    id: generateId(),
    organization_id: orgId,
    name: "Sucursal General",
    address: "Calle Reina, Centro Habana",
    business_type: "GENERAL" /* GENERAL */,
    created_at: now,
    updated_at: now
  });
  insert("system_settings", { id: generateId(), key: "exchange_rate_mlc", value: "120" });
  insert("system_settings", { id: generateId(), key: "business_name", value: "Nimbo ERP S.R.L." });
  insert("system_settings", { id: generateId(), key: "business_address", value: "La Habana, Cuba" });
  insert("users", { id: generateId(), name: "Administrador Panader\xEDa", email: "admin@bakery.com", password: demoPass, role: "ADMIN" /* ADMIN */, branch_id: bBakery.id, created_at: now, updated_at: now });
  insert("users", { id: generateId(), name: "Cajero Ropa", email: "cajero@ropa.com", password: demoPass, role: "CAJERO" /* CAJERO */, branch_id: bClothing.id, created_at: now, updated_at: now });
  insert("users", { id: generateId(), name: "Gerente Ropa", email: "admin@ropa.com", password: demoPass, role: "GERENTE" /* GERENTE */, branch_id: bClothing.id, created_at: now, updated_at: now });
  insert("users", { id: generateId(), name: "Administrador General", email: "admin@nimbo.com", password: demoPass, role: "ADMIN" /* ADMIN */, branch_id: bGeneral.id, created_at: now, updated_at: now });
  const catAlimentos = insert("categories", { id: generateId(), name: "Alimentos", slug: "alimentos" });
  const catPanes = insert("categories", { id: generateId(), name: "Panes", slug: "panes", parent_id: catAlimentos.id });
  const catDulces = insert("categories", { id: generateId(), name: "Dulces y Pasteles", slug: "dulces", parent_id: catAlimentos.id });
  insert("categories", { id: generateId(), name: "Materias Primas", slug: "materias-primas" });
  insert("categories", { id: generateId(), name: "Moda y Ropa", slug: "moda" });
  insert("categories", { id: generateId(), name: "Muebles", slug: "muebles" });
  const taxIva = insert("taxes", { id: generateId(), name: "IVA 10%", rate: 0.1, type: "IVA" });
  insert("taxes", { id: generateId(), name: "Exento", rate: 0, type: "exento" });
  const whBakery = insert("warehouses", { id: generateId(), name: "Almac\xE9n Principal Panader\xEDa", branch_id: bBakery.id, address: "Vedado" });
  const whClothing = insert("warehouses", { id: generateId(), name: "Almac\xE9n Central Boutique", branch_id: bClothing.id, address: "San Rafael" });
  const whWorkshop = insert("warehouses", { id: generateId(), name: "Almac\xE9n Taller", branch_id: bWorkshop.id, address: "Boyeros" });
  const whGeneral = insert("warehouses", { id: generateId(), name: "Almac\xE9n Central", branch_id: bGeneral.id, address: "Centro Habana" });
  const pPanSuave = insert("products", { id: generateId(), name: "Pan Suave de Leche", description: "Pan de molde enriquecido con leche fresca", sku: "BAK-PAN-001", barcode: "5901234123", unit_of_measure: "pieza", is_service: 0, category_id: catPanes.id, tax_id: taxIva.id, price_cup: 35, price_mlc: 0.3, cost_cup: 15, cost_mlc: 0.12, created_at: now, updated_at: now });
  const pPastel = insert("products", { id: generateId(), name: "Pastel de Chocolate", description: "Rico pastel de chocolate de 1 libra", sku: "BAK-PAS-002", barcode: "5901234124", unit_of_measure: "pieza", is_service: 0, category_id: catDulces.id, tax_id: taxIva.id, price_cup: 1200, price_mlc: 10, cost_cup: 450, cost_mlc: 3.75, created_at: now, updated_at: now });
  const pHarina = insert("products", { id: generateId(), name: "Harina de Trigo", description: "Materia prima para panader\xEDa", sku: "MAT-HAR-001", barcode: "", unit_of_measure: "kg", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 0, price_mlc: 0, cost_cup: 180, cost_mlc: 1.5, created_at: now, updated_at: now });
  const pAzucar = insert("products", { id: generateId(), name: "Az\xFAcar Refinada", description: "Saco de az\xFAcar", sku: "MAT-AZU-002", barcode: "", unit_of_measure: "kg", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 0, price_mlc: 0, cost_cup: 150, cost_mlc: 1.25, created_at: now, updated_at: now });
  const pLevadura = insert("products", { id: generateId(), name: "Levadura Seca", description: "Levadura instant\xE1nea", sku: "MAT-LEV-003", barcode: "", unit_of_measure: "kg", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 0, price_mlc: 0, cost_cup: 480, cost_mlc: 4, created_at: now, updated_at: now });
  const pCamisa = insert("products", { id: generateId(), name: "Camisa de Lino Nimbo", description: "Camisa de vestir 100% lino cubano", sku: "CLO-CAM-001", barcode: "6901123451", unit_of_measure: "pieza", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 2400, price_mlc: 20, cost_cup: 1e3, cost_mlc: 8.3, created_at: now, updated_at: now });
  const pMesa = insert("products", { id: generateId(), name: "Mesa de Centro R\xFAstica", description: "Mesa de centro fabricada en madera preciosa", sku: "WRK-MES-001", barcode: "", unit_of_measure: "pieza", is_service: 0, category_id: catAlimentos.id, tax_id: taxIva.id, price_cup: 15e3, price_mlc: 125, cost_cup: 7e3, cost_mlc: 58.3, created_at: now, updated_at: now });
  const varCamisaM = insert("variants", { id: generateId(), product_id: pCamisa.id, name: "Talla M - Blanco", sku: "CLO-CAM-001-M-W", barcode: "690112345101", price_cup: 2400, price_mlc: 20, cost_cup: 1e3, cost_mlc: 8.3, stock: 25 });
  const varCamisaL = insert("variants", { id: generateId(), product_id: pCamisa.id, name: "Talla L - Blanco", sku: "CLO-CAM-001-L-W", barcode: "690112345102", price_cup: 2500, price_mlc: 21, cost_cup: 1050, cost_mlc: 8.75, stock: 15 });
  insert("stocks", { id: generateId(), product_id: pPanSuave.id, warehouse_id: whBakery.id, quantity: 150, min_stock: 30, max_stock: 500 });
  insert("stocks", { id: generateId(), product_id: pPastel.id, warehouse_id: whBakery.id, quantity: 15, min_stock: 5, max_stock: 50 });
  insert("stocks", { id: generateId(), product_id: pHarina.id, warehouse_id: whBakery.id, quantity: 500, min_stock: 100, max_stock: 2e3 });
  insert("stocks", { id: generateId(), product_id: pAzucar.id, warehouse_id: whBakery.id, quantity: 200, min_stock: 50, max_stock: 1e3 });
  insert("stocks", { id: generateId(), product_id: pLevadura.id, warehouse_id: whBakery.id, quantity: 10, min_stock: 2, max_stock: 50 });
  insert("stocks", { id: generateId(), product_id: pCamisa.id, variant_id: varCamisaM.id, warehouse_id: whClothing.id, quantity: 25, min_stock: 5, max_stock: 100 });
  insert("stocks", { id: generateId(), product_id: pCamisa.id, variant_id: varCamisaL.id, warehouse_id: whClothing.id, quantity: 15, min_stock: 5, max_stock: 100 });
  insert("stocks", { id: generateId(), product_id: pMesa.id, warehouse_id: whWorkshop.id, quantity: 3, min_stock: 1, max_stock: 20 });
  insert("suppliers", { id: generateId(), name: "Molinos del Caribe S.A.", contact: "Juan P\xE9rez", tax_id: "ONAT-5012395", email: "juan@molinos.cu", phone: "+53 52839211", address: "Zona Especial de Mariel, Artemisa", payment_terms: "30 d\xEDas" });
  insert("suppliers", { id: generateId(), name: "Textiles Habana", contact: "Marta Rodr\xEDguez", tax_id: "ONAT-1294821", email: "marta@textiles.cu", phone: "+53 78321010", address: "Avenida de Italia, La Habana", payment_terms: "Contado" });
  insert("customers", { id: generateId(), name: "Pedro Dom\xEDnguez", email: "pedro@gmail.com", phone: "+53 54310212", address: "Calle O, Vedado", credit_limit: 5e3, current_balance: 0, loyalty_points: 120 });
  insert("customers", { id: generateId(), name: "Mar\xEDa Elena Garc\xEDa", email: "maria@nauta.cu", phone: "+53 51102931", address: "Plaza de la Revoluci\xF3n, La Habana", credit_limit: 15e3, current_balance: 3200, loyalty_points: 450 });
  insert("customers", { id: generateId(), name: "Cliente Final", email: "", phone: "", address: "", credit_limit: 0, current_balance: 0, loyalty_points: 0 });
  const recPan = insert("recipes", { id: generateId(), name: "Receta Est\xE1ndar Pan Suave", product_id: pPanSuave.id, yield_quantity: 100, yield_unit: "pieza" });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPan.id, ingredient_product_id: pHarina.id, quantity: 15, unit: "kg", waste_percent: 2 });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPan.id, ingredient_product_id: pAzucar.id, quantity: 1.5, unit: "kg", waste_percent: 0 });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPan.id, ingredient_product_id: pLevadura.id, quantity: 0.3, unit: "kg", waste_percent: 1 });
  const recPastel = insert("recipes", { id: generateId(), name: "Receta Pastel Chocolate 1 Lb", product_id: pPastel.id, yield_quantity: 1, yield_unit: "pieza" });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPastel.id, ingredient_product_id: pHarina.id, quantity: 0.3, unit: "kg", waste_percent: 5 });
  insert("recipe_ingredients", { id: generateId(), recipe_id: recPastel.id, ingredient_product_id: pAzucar.id, quantity: 0.2, unit: "kg", waste_percent: 1 });
  const empYusnier = insert("employees", { id: generateId(), first_name: "Yusnier", last_name: "Mesa", hire_date: "2024-01-15", base_salary: 18e3, payment_type: "salary", bank_account: "9224123456789012", tax_id: "89110412345", social_security_number: "SS-1294821", vacation_days: 24 });
  const empYadira = insert("employees", { id: generateId(), first_name: "Yadira", last_name: "Vald\xE9s", hire_date: "2024-03-01", base_salary: 15e3, payment_type: "salary", bank_account: "9224123456789033", tax_id: "91021245678", social_security_number: "SS-2384912", vacation_days: 24 });
  const today = (/* @__PURE__ */ new Date()).toISOString().substring(0, 10);
  insert("attendances", { id: generateId(), employee_id: empYusnier.id, date: today, check_in: `${today}T08:00:00.000Z`, check_out: `${today}T17:00:00.000Z`, hours_worked: 8 });
  insert("attendances", { id: generateId(), employee_id: empYadira.id, date: today, check_in: `${today}T08:15:00.000Z`, check_out: `${today}T17:00:00.000Z`, hours_worked: 7.75 });
  const chartAccounts = [
    ["1010", "1010", "Caja Principal CUP", "asset"],
    ["1020", "1020", "Caja Principal MLC", "asset"],
    ["1030", "1030", "Cuentas por Cobrar Clientes", "asset"],
    ["1040", "1040", "Inventario de Mercanc\xEDas", "asset"],
    ["1050", "1050", "Inventario de Materias Primas", "asset"],
    ["2010", "2010", "Cuentas por Pagar Proveedores", "liability"],
    ["3010", "3010", "Capital Social", "equity"],
    ["4010", "4010", "Ingresos por Ventas", "income"],
    ["5010", "5010", "Costo de Ventas", "expense"],
    ["5020", "5020", "Gastos de Salarios", "expense"],
    ["5030", "5030", "Gastos El\xE9ctricos y Operativos", "expense"]
  ];
  for (const [id, code, name, type] of chartAccounts) {
    insert("accounts", { id, code, name, type });
  }
  insert("cash_register_sessions", { id: generateId(), branch_id: bBakery.id, user_id: "admin_bakery_placeholder", initial_cash: 5e3, status: "open", start_date: now });
  const sale1 = insert("sales", { id: generateId(), branch_id: bBakery.id, customer_id: "cust_pedro", date: new Date(Date.now() - 864e5).toISOString(), total_cup: 1235, total_mlc: 10.3, tax_total_cup: 120, tax_total_mlc: 1, discount: 0, grand_total_cup: 1355, grand_total_mlc: 11.3, payment_method: "Transferm\xF3vil", status: "completed", user_id: "admin_bakery_placeholder", created_at: now, updated_at: now });
  insert("sale_items", { id: generateId(), sale_id: sale1.id, product_id: pPastel.id, quantity: 1, unit_price_cup: 1200, unit_price_mlc: 10, tax: 120, discount: 0 });
  insert("sale_items", { id: generateId(), sale_id: sale1.id, product_id: pPanSuave.id, quantity: 1, unit_price_cup: 35, unit_price_mlc: 0.3, tax: 0, discount: 0 });
  insert("payments", { id: generateId(), sale_id: sale1.id, method: "Transferm\xF3vil", currency: "CUP", amount: 1355, reference: "TM-482918" });
  const je1 = insert("journal_entries", { id: generateId(), description: "Venta Factura " + sale1.id, reference: sale1.id, status: "posted", date: now });
  insert("journal_entry_lines", { id: generateId(), journal_entry_id: je1.id, account_id: "1010", debit: 1355, credit: 0 });
  insert("journal_entry_lines", { id: generateId(), journal_entry_id: je1.id, account_id: "4010", debit: 0, credit: 1355 });
  console.log("Database successfully initialized!");
}
function toSnake(str) {
  return str.replace(/[A-Z]/g, (l) => "_" + l.toLowerCase());
}
function toCamel(row) {
  if (!row) return row;
  const result = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    result[camelKey] = row[key];
  }
  return result;
}
function rowsToCamel(rows) {
  return rows.map(toCamel);
}
var db = {
  organizations: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM organizations"))),
    findById: (id) => toCamel(firstRow(getDb().prepare("SELECT * FROM organizations WHERE id = ?"), [id])),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const expires = /* @__PURE__ */ new Date();
      expires.setDate(expires.getDate() + 7);
      getDb().prepare(`INSERT INTO organizations (id, name, subscription_status, subscription_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.name, "active", expires.toISOString(), now, now);
      return { id, ...data, subscriptionStatus: "active", subscriptionExpiresAt: expires.toISOString(), createdAt: now, updatedAt: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE organizations SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.organizations.findById(id);
    }
  },
  branches: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM branches"))),
    findById: (id) => toCamel(firstRow(getDb().prepare("SELECT * FROM branches WHERE id = ?"), [id])),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO branches (id, organization_id, name, address, business_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.organizationId, data.name, data.address || "", data.businessType || "", now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE branches SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.branches.findById(id);
    }
  },
  users: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM users"))),
    findById: (id) => toCamel(firstRow(getDb().prepare("SELECT * FROM users WHERE id = ?"), [id])),
    findByEmail: (email) => toCamel(firstRow(getDb().prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)"), [email])),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO users (id, name, email, password, role, branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.email, data.password || "", data.role, data.branchId, now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE users SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.users.findById(id);
    }
  },
  categories: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM categories"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO categories (id, name, slug, parent_id) VALUES (?, ?, ?, ?)`).run(id, data.name, data.slug || "", data.parentId || null);
      return { id, ...data };
    },
    delete: (id) => {
      getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
      return true;
    }
  },
  taxes: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM taxes"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO taxes (id, name, rate, type) VALUES (?, ?, ?, ?)`).run(id, data.name, data.rate, data.type);
      return { id, ...data };
    }
  },
  products: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM products"))),
    findById: (id) => toCamel(firstRow(getDb().prepare("SELECT * FROM products WHERE id = ?"), [id])),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO products (id, name, description, sku, barcode, unit_of_measure, is_service, category_id, tax_id, price_cup, price_mlc, cost_cup, cost_mlc, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.description || "", data.sku || "", data.barcode || "", data.unitOfMeasure || "pieza", data.isService ? 1 : 0, data.categoryId || null, data.taxId || null, data.priceCUP || 0, data.priceMLC || 0, data.costCUP || 0, data.costMLC || 0, data.imageUrl || "", now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        if (k === "isService") {
          sets.push("is_service = ?");
          vals.push(v ? 1 : 0);
        } else {
          sets.push(`${toSnake(k)} = ?`);
          vals.push(v);
        }
      }
      vals.push(id);
      getDb().prepare(`UPDATE products SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.products.findById(id);
    },
    delete: (id) => {
      getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
      return true;
    }
  },
  variants: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM variants"))),
    findByProductId: (productId) => rowsToCamel(allRows(getDb().prepare("SELECT * FROM variants WHERE product_id = ?"), [productId])),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO variants (id, product_id, name, sku, barcode, price_cup, price_mlc, cost_cup, cost_mlc, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.productId, data.name, data.sku || "", data.barcode || "", data.priceCUP || 0, data.priceMLC || 0, data.costCUP || 0, data.costMLC || 0, data.stock || 0);
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE variants SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      const row = firstRow(getDb().prepare("SELECT * FROM variants WHERE id = ?"), [id]);
      return row ? toCamel(row) : null;
    },
    deleteByProductId: (productId) => {
      getDb().prepare("DELETE FROM variants WHERE product_id = ?").run(productId);
    },
    delete: (id) => {
      getDb().prepare("DELETE FROM variants WHERE id = ?").run(id);
    }
  },
  warehouses: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM warehouses"))),
    findByBranchId: (branchId) => rowsToCamel(allRows(getDb().prepare("SELECT * FROM warehouses WHERE branch_id = ?"), [branchId])),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO warehouses (id, name, address, branch_id) VALUES (?, ?, ?, ?)`).run(id, data.name, data.address || "", data.branchId);
      return { id, ...data };
    }
  },
  stocks: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM stocks"))),
    findByWarehouseId: (whId) => rowsToCamel(allRows(getDb().prepare("SELECT * FROM stocks WHERE warehouse_id = ?"), [whId])),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO stocks (id, product_id, variant_id, warehouse_id, quantity, min_stock, max_stock) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.productId, data.variantId || null, data.warehouseId, data.quantity || 0, data.minStock || 5, data.maxStock || 9999);
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE stocks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      const row = firstRow(getDb().prepare("SELECT * FROM stocks WHERE id = ?"), [id]);
      return row ? toCamel(row) : null;
    }
  },
  stockMovements: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM stock_movements"))),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO stock_movements (id, stock_id, type, quantity, reason, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.stockId, data.type, data.quantity, data.reason || "", data.userId || "sistema", now);
      return { id, ...data, createdAt: now };
    }
  },
  transfers: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM transfers"))),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO transfers (id, from_warehouse_id, to_warehouse_id, status, items, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.fromWarehouseId, data.toWarehouseId, data.status || "completada", JSON.stringify(data.items || []), data.createdBy || "sistema", now);
      return { id, ...data, createdAt: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE transfers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  suppliers: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM suppliers"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO suppliers (id, name, contact, tax_id, email, phone, address, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.contact || "", data.taxId || "", data.email || "", data.phone || "", data.address || "", data.paymentTerms || "");
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE suppliers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  purchaseOrders: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM purchase_orders"))),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO purchase_orders (id, supplier_id, warehouse_id, status, order_date, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.supplierId, data.warehouseId, data.status || "draft", data.orderDate || now.substring(0, 10), data.notes || "", data.createdBy || "admin", now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE purchase_orders SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  purchaseOrderItems: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM purchase_order_items"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO purchase_order_items (id, purchase_order_id, product_id, variant_id, quantity, unit_cost_cup, unit_cost_mlc, received_qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.purchaseOrderId, data.productId, data.variantId || null, data.quantity || 0, data.unitCostCUP || 0, data.unitCostMLC || 0, data.receivedQty || 0);
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE purchase_order_items SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  supplierInvoices: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM supplier_invoices"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO supplier_invoices (id, supplier_id, purchase_order_id, total_cup, total_mlc, paid_amount_cup, paid_amount_mlc, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.supplierId, data.purchaseOrderId || null, data.totalCUP || 0, data.totalMLC || 0, data.paidAmountCUP || 0, data.paidAmountMLC || 0, data.status || "pendiente");
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE supplier_invoices SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  customers: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM customers"))),
    findById: (id) => toCamel(firstRow(getDb().prepare("SELECT * FROM customers WHERE id = ?"), [id])),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO customers (id, name, email, phone, address, tax_id, credit_limit, current_balance, loyalty_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.email || "", data.phone || "", data.address || "", data.taxId || "", data.creditLimit || 0, data.currentBalance || 0, data.loyaltyPoints || 0);
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return db.customers.findById(id);
    }
  },
  sales: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM sales"))),
    findById: (id) => toCamel(firstRow(getDb().prepare("SELECT * FROM sales WHERE id = ?"), [id])),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO sales (id, branch_id, customer_id, date, total_cup, total_mlc, tax_total_cup, tax_total_mlc, discount, grand_total_cup, grand_total_mlc, payment_method, status, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.branchId, data.customerId || null, data.date || now, data.totalCUP || 0, data.totalMLC || 0, data.taxTotalCUP || 0, data.taxTotalMLC || 0, data.discount || 0, data.grandTotalCUP || 0, data.grandTotalMLC || 0, data.paymentMethod || "efectivo", data.status || "completed", data.userId || "sistema", now, now);
      return { id, ...data, createdAt: now, updatedAt: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE sales SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
      return db.sales.findById(id);
    }
  },
  saleItems: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM sale_items"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO sale_items (id, sale_id, product_id, variant_id, quantity, unit_price_cup, unit_price_mlc, tax, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.saleId, data.productId, data.variantId || null, data.quantity || 0, data.unitPriceCUP || 0, data.unitPriceMLC || 0, data.tax || 0, data.discount || 0);
      return { id, ...data };
    }
  },
  payments: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM payments"))),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO payments (id, sale_id, method, currency, amount, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.saleId, data.method, data.currency || "CUP", data.amount || 0, data.reference || null, now);
      return { id, ...data, createdAt: now };
    }
  },
  cashRegisterSessions: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM cash_register_sessions"))),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO cash_register_sessions (id, branch_id, user_id, start_date, initial_cash, status) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.branchId, data.userId || "", now, data.initialCash || 0, data.status || "open");
      return { id, ...data, startDate: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE cash_register_sessions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  orders: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM orders"))),
    findById: (id) => toCamel(firstRow(getDb().prepare("SELECT * FROM orders WHERE id = ?"), [id])),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO orders (id, branch_id, customer_id, order_date, delivery_date, status, total_cup, total_mlc, notes, delivery_address, assigned_driver_id, advance_payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.branchId, data.customerId || null, now, data.deliveryDate || null, data.status || "pending", data.totalCUP || 0, data.totalMLC || 0, data.notes || "", data.deliveryAddress || "", data.assignedDriverId || "", data.advancePayment || 0);
      return { id, ...data, orderDate: now };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  orderItems: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM order_items"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO order_items (id, order_id, product_id, variant_id, quantity, unit_price_cup, unit_price_mlc) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.orderId, data.productId, data.variantId || null, data.quantity || 0, data.unitPriceCUP || 0, data.unitPriceMLC || 0);
      return { id, ...data };
    }
  },
  recipes: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM recipes"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO recipes (id, name, product_id, yield_quantity, yield_unit) VALUES (?, ?, ?, ?, ?)`).run(id, data.name, data.productId, data.yieldQuantity || 1, data.yieldUnit || "pieza");
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE recipes SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
    delete: (id) => {
      getDb().prepare("DELETE FROM recipes WHERE id = ?").run(id);
    }
  },
  recipeIngredients: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM recipe_ingredients"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO recipe_ingredients (id, recipe_id, ingredient_product_id, quantity, unit, waste_percent) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.recipeId, data.ingredientProductId, data.quantity || 0, data.unit || "kg", data.wastePercent || 0);
      return { id, ...data };
    },
    deleteByRecipeId: (recipeId) => {
      getDb().prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(recipeId);
    }
  },
  productionOrders: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM production_orders"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO production_orders (id, product_id, recipe_id, planned_quantity, produced_quantity, status, warehouse_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.productId, data.recipeId || null, data.plannedQuantity || 0, 0, data.status || "planned", data.warehouseId, data.notes || "");
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE production_orders SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  accounts: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM accounts"))),
    create: (data) => {
      getDb().prepare(`INSERT INTO accounts (id, code, name, type) VALUES (?, ?, ?, ?)`).run(data.id, data.code, data.name, data.type);
      return data;
    }
  },
  journalEntries: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM journal_entries"))),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO journal_entries (id, description, reference, status, date) VALUES (?, ?, ?, ?, ?)`).run(id, data.description || "", data.reference || "", data.status || "draft", now);
      return { id, ...data, date: now };
    }
  },
  journalEntryLines: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM journal_entry_lines"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?, ?)`).run(id, data.journalEntryId, data.accountId, data.debit || 0, data.credit || 0);
      return { id, ...data };
    }
  },
  cashRegisterTransactions: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM cash_register_transactions"))),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO cash_register_transactions (id, type, amount, currency, description, category, date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.type, data.amount || 0, data.currency || "CUP", data.description || "", data.category || "General", now, data.userId || "sistema");
      return { id, ...data, date: now };
    }
  },
  employees: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM employees"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO employees (id, first_name, last_name, hire_date, base_salary, payment_type, bank_account, tax_id, social_security_number, vacation_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.firstName, data.lastName, data.hireDate || (/* @__PURE__ */ new Date()).toISOString().substring(0, 10), data.baseSalary || 0, data.paymentType || "salary", data.bankAccount || "", data.taxId || "", data.socialSecurityNumber || "", data.vacationDays || 24);
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    },
    delete: (id) => {
      getDb().prepare("DELETE FROM employees WHERE id = ?").run(id);
    }
  },
  attendances: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM attendances"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO attendances (id, employee_id, date, check_in, check_out, hours_worked) VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.employeeId, data.date, data.checkIn || null, data.checkOut || null, data.hoursWorked || null);
      return { id, ...data };
    }
  },
  payrollPeriods: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM payroll_periods"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO payroll_periods (id, start_date, end_date, status) VALUES (?, ?, ?, ?)`).run(id, data.startDate, data.endDate, data.status || "draft");
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE payroll_periods SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  },
  payrollDetails: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM payroll_details"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO payroll_details (id, payroll_period_id, employee_id, base_amount, overtime, bonuses, deductions, net_pay) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.payrollPeriodId, data.employeeId, data.baseAmount || 0, data.overtime || 0, data.bonuses || 0, data.deductions || 0, data.netPay || 0);
      return { id, ...data };
    }
  },
  auditLogs: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM audit_logs"))),
    create: (data) => {
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      getDb().prepare(`INSERT INTO audit_logs (id, user_id, action, entity, entity_id, changes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.userId, data.action, data.entity, data.entityId || null, data.changes || null, now);
      return { id, ...data, createdAt: now };
    }
  },
  systemSettings: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM system_settings"))),
    getValue: (key, defaultVal) => {
      const row = firstRow(getDb().prepare("SELECT value FROM system_settings WHERE key = ?"), [key]);
      return row ? row.value : defaultVal;
    },
    setValue: (key, value) => {
      const existing = firstRow(getDb().prepare("SELECT id FROM system_settings WHERE key = ?"), [key]);
      if (existing) {
        getDb().prepare("UPDATE system_settings SET value = ? WHERE key = ?").run(value, key);
      } else {
        getDb().prepare("INSERT INTO system_settings (id, key, value) VALUES (?, ?, ?)").run(generateId(), key, value);
      }
    }
  },
  subscriptionPayments: {
    findMany: () => rowsToCamel(allRows(getDb().prepare("SELECT * FROM subscription_payments"))),
    create: (data) => {
      const id = generateId();
      getDb().prepare(`INSERT INTO subscription_payments (id, organization_id, amount, currency, platform, phone, transaction_id, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.organizationId, data.amount || 0, data.currency || "CUP", data.platform, data.phone || "", data.transactionId, data.status || "pending", data.date || (/* @__PURE__ */ new Date()).toISOString());
      return { id, ...data };
    },
    update: (id, data) => {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push(`${toSnake(k)} = ?`);
        vals.push(v);
      }
      vals.push(id);
      getDb().prepare(`UPDATE subscription_payments SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return { id, ...data };
    }
  }
};

// server.ts
var PORT = parseInt(process.env.PORT || "3000", 10);
var JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "dev-secret-do-not-use-in-prod-" + Math.random().toString(36);
})();
var SALT_ROUNDS = 10;
function generateToken(payload) {
  return import_jsonwebtoken.default.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Token de autenticaci\xF3n requerido" });
  }
  try {
    req.user = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inv\xE1lido o expirado" });
  }
}
function logAudit(userId, action, entity, entityId, changes) {
  try {
    db.auditLogs.create({ userId, action, entity, entityId, changes });
  } catch (e) {
    console.error("Audit logging failed:", e);
  }
}
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().email("Email inv\xE1lido"),
  password: import_zod.z.string().min(1, "Contrase\xF1a requerida")
});
var registerSchema = import_zod.z.object({
  orgName: import_zod.z.string().min(1, "Nombre de organizaci\xF3n requerido"),
  branchName: import_zod.z.string().min(1, "Nombre de sucursal requerido"),
  userName: import_zod.z.string().min(1, "Nombre de usuario requerido"),
  email: import_zod.z.string().email("Email inv\xE1lido"),
  password: import_zod.z.string().min(6, "La contrase\xF1a debe tener al menos 6 caracteres"),
  businessType: import_zod.z.nativeEnum(BusinessType).optional()
});
var paymentSchema = import_zod.z.object({
  orgId: import_zod.z.string().min(1),
  platform: import_zod.z.enum(["transfermovil", "enzona"]),
  phone: import_zod.z.string().optional(),
  transactionId: import_zod.z.string().min(1, "ID de transacci\xF3n requerido"),
  amount: import_zod.z.number().positive(),
  userId: import_zod.z.string().optional()
});
var productSchema = import_zod.z.object({
  name: import_zod.z.string().min(1, "Nombre del producto requerido"),
  description: import_zod.z.string().optional(),
  sku: import_zod.z.string().optional(),
  barcode: import_zod.z.string().optional(),
  unitOfMeasure: import_zod.z.string().optional(),
  isService: import_zod.z.boolean().optional(),
  categoryId: import_zod.z.string().optional(),
  taxId: import_zod.z.string().optional(),
  priceCUP: import_zod.z.number().optional(),
  priceMLC: import_zod.z.number().optional(),
  costCUP: import_zod.z.number().optional(),
  costMLC: import_zod.z.number().optional(),
  imageUrl: import_zod.z.string().optional(),
  variants: import_zod.z.array(import_zod.z.any()).optional(),
  userId: import_zod.z.string().optional()
});
var saleSchema = import_zod.z.object({
  branchId: import_zod.z.string().min(1),
  customerId: import_zod.z.string().optional(),
  items: import_zod.z.array(import_zod.z.object({
    productId: import_zod.z.string().min(1),
    variantId: import_zod.z.string().optional(),
    quantity: import_zod.z.number().positive(),
    priceCUP: import_zod.z.number().optional(),
    priceMLC: import_zod.z.number().optional(),
    tax: import_zod.z.number().optional(),
    discount: import_zod.z.number().optional()
  })).min(1, "Debe haber al menos un producto"),
  totalCUP: import_zod.z.number().optional(),
  totalMLC: import_zod.z.number().optional(),
  taxTotalCUP: import_zod.z.number().optional(),
  taxTotalMLC: import_zod.z.number().optional(),
  discount: import_zod.z.number().optional(),
  grandTotalCUP: import_zod.z.number().optional(),
  grandTotalMLC: import_zod.z.number().optional(),
  paymentMethod: import_zod.z.string().optional(),
  payments: import_zod.z.array(import_zod.z.any()).optional(),
  userId: import_zod.z.string().optional(),
  isCredit: import_zod.z.boolean().optional(),
  loyaltyPointsRedeemed: import_zod.z.number().optional()
});
async function startServer() {
  const app = (0, import_express.default)();
  app.use((0, import_helmet.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  app.use((0, import_cors.default)({
    origin: process.env.APP_URL || true,
    credentials: true
  }));
  app.use(import_express.default.json({ limit: "10mb" }));
  app.use((0, import_cookie_parser.default)());
  const authLimiter = (0, import_express_rate_limit.default)({
    windowMs: 15 * 60 * 1e3,
    max: 20,
    message: { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false
  });
  const apiLimiter = (0, import_express_rate_limit.default)({
    windowMs: 60 * 1e3,
    max: 200,
    message: { error: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use("/api/auth", authLimiter);
  app.use("/api", apiLimiter);
  app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  });
  try {
    initializeDatabase();
  } catch (err) {
    console.error("Database initialization failed", err);
  }
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime()
    });
  });
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
    const savedPassword = user.password || "123456";
    const isMatch = savedPassword.startsWith("$2a$") ? await import_bcryptjs2.default.compare(password, savedPassword) : password === savedPassword;
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    const branch = db.branches.findById(user.branchId);
    const org = branch ? db.organizations.findById(branch.organizationId) : null;
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId
    });
    logAudit(user.id, "LOGIN", "User", user.id);
    const { password: _pw, ...safeUser } = user;
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1e3
    });
    return res.json({
      user: safeUser,
      branch,
      organization: org,
      token
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
      return res.status(400).json({ error: "El correo electr\xF3nico ya est\xE1 registrado" });
    }
    const hashedPassword = await import_bcryptjs2.default.hash(password, SALT_ROUNDS);
    const org = db.organizations.create({ name: orgName });
    const branch = db.branches.create({
      organizationId: org.id,
      name: branchName,
      address: "Direcci\xF3n de registro",
      businessType: businessType || "GENERAL" /* GENERAL */
    });
    const user = db.users.create({
      name: userName,
      email,
      password: hashedPassword,
      role: "ADMIN" /* ADMIN */,
      branchId: branch.id
    });
    db.warehouses.create({
      name: `Almac\xE9n Principal ${branchName}`,
      branchId: branch.id,
      address: "Almac\xE9n por defecto"
    });
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId
    });
    logAudit(user.id, "REGISTER", "User", user.id, `Created organization ${orgName} and branch ${branchName}`);
    const { password: _pw, ...safeUser } = user;
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1e3
    });
    return res.json({
      user: safeUser,
      branch,
      organization: org,
      token
    });
  });
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("token");
    return res.json({ success: true });
  });
  app.get("/api/auth/me", authenticate, (req, res) => {
    const user = db.users.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const { password: _pw, ...safeUser } = user;
    return res.json(safeUser);
  });
  app.get("/api/auth/organization", (req, res) => {
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId es requerido" });
    }
    const org = db.organizations.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organizaci\xF3n no encontrada" });
    }
    return res.json(org);
  });
  app.post("/api/auth/onboarding", authenticate, (req, res) => {
    const { branchId, businessType } = req.body;
    if (!branchId || !businessType) {
      return res.status(400).json({ error: "Faltan par\xE1metros de onboarding" });
    }
    const branch = db.branches.update(branchId, { businessType });
    if (!branch) {
      return res.status(404).json({ error: "Sucursal no encontrada" });
    }
    logAudit(req.user.userId, "ONBOARDING", "Branch", branchId, `Set businessType to ${businessType}`);
    return res.json({ branch });
  });
  app.get("/api/subscription/payments", authenticate, (req, res) => {
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: "orgId es requerido" });
    }
    try {
      const allPayments = db.subscriptionPayments.findMany();
      const orgPayments = allPayments.filter((p) => p.organizationId === orgId);
      orgPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return res.json(orgPayments);
    } catch (e) {
      console.error("Failed to fetch subscription payments:", e);
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
      return res.status(404).json({ error: "Organizaci\xF3n no encontrada" });
    }
    const expires = /* @__PURE__ */ new Date();
    expires.setDate(expires.getDate() + 30);
    const updatedOrg = db.organizations.update(orgId, {
      subscriptionStatus: "active",
      subscriptionExpiresAt: expires.toISOString(),
      lastPaymentDate: (/* @__PURE__ */ new Date()).toISOString(),
      paymentPlatform: platform,
      paymentPhone: phone || "",
      paymentTxId: transactionId
    });
    const auditUserId = userId || req.user.userId;
    logAudit(auditUserId, "PAY_SUBSCRIPTION", "Organization", orgId, `Paid ${amount} CUP via ${platform} with TxId: ${transactionId}`);
    try {
      db.subscriptionPayments.create({
        organizationId: orgId,
        amount: Number(amount),
        currency: "CUP" /* CUP */,
        platform,
        phone: phone || "",
        transactionId,
        status: "verified"
      });
    } catch (e) {
      console.error("Failed to create subscriptionPayment record:", e);
    }
    try {
      const trans = db.cashRegisterTransactions.create({
        amount: Number(amount),
        type: "income",
        currency: "CUP" /* CUP */,
        description: `Pago mensual suscripci\xF3n Nimbo ERP: Org ${org.name} (Plataforma: ${platform}, Ref: ${transactionId})`,
        category: "Suscripciones",
        userId: auditUserId
      });
      db.journalEntries.create({
        description: `Ingreso por Suscripci\xF3n mensual ERP: ${org.name}`,
        reference: trans.id,
        status: "posted"
      });
    } catch (e) {
      console.error("Failed to log subscription to journal:", e);
    }
    return res.json({
      success: true,
      message: "Pago registrado con \xE9xito. Suscripci\xF3n renovada por 30 d\xEDas.",
      organization: updatedOrg
    });
  });
  app.get("/api/products", (req, res) => {
    const productsList = db.products.findMany();
    const variantsList = db.variants.findMany();
    const categoriesList = db.categories.findMany();
    const taxesList = db.taxes.findMany();
    const detailed = productsList.map((p) => {
      const vars = variantsList.filter((v) => v.productId === p.id);
      const cat = categoriesList.find((c) => c.id === p.categoryId);
      const tax = taxesList.find((t) => t.id === p.taxId);
      return { ...p, variants: vars, category: cat, tax };
    });
    return res.json(detailed);
  });
  app.post("/api/products", authenticate, async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const {
      name,
      description,
      sku,
      barcode,
      unitOfMeasure,
      isService,
      categoryId,
      taxId,
      priceCUP,
      priceMLC,
      costCUP,
      costMLC,
      imageUrl,
      variants,
      userId
    } = parsed.data;
    const prod = db.products.create({
      name,
      description: description || "",
      sku: sku || "",
      barcode: barcode || "",
      unitOfMeasure: unitOfMeasure || "pieza",
      isService: !!isService,
      categoryId: categoryId || void 0,
      taxId: taxId || void 0,
      priceCUP: Number(priceCUP) || 0,
      priceMLC: Number(priceMLC) || 0,
      costCUP: Number(costCUP) || 0,
      costMLC: Number(costMLC) || 0,
      imageUrl: imageUrl || ""
    });
    if (variants && Array.isArray(variants)) {
      variants.forEach((v) => {
        db.variants.create({
          productId: prod.id,
          name: v.name,
          sku: v.sku || "",
          barcode: v.barcode || "",
          priceCUP: Number(v.priceCUP) || 0,
          priceMLC: Number(v.priceMLC) || 0,
          costCUP: Number(v.costCUP) || 0,
          costMLC: Number(v.costMLC) || 0,
          stock: Number(v.stock) || 0
        });
      });
    }
    const warehouses = db.warehouses.findMany();
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
            maxStock: 9999
          });
        });
      } else {
        db.stocks.create({
          productId: prod.id,
          warehouseId: w.id,
          quantity: 0,
          minStock: 5,
          maxStock: 9999
        });
      }
    });
    const auditUserId = userId || req.user.userId;
    logAudit(auditUserId, "CREATE", "Product", prod.id, `Created product ${name}`);
    return res.json(prod);
  });
  app.put("/api/products/:id", (req, res) => {
    const { id } = req.params;
    const {
      name,
      description,
      sku,
      barcode,
      unitOfMeasure,
      isService,
      categoryId,
      taxId,
      priceCUP,
      priceMLC,
      costCUP,
      costMLC,
      imageUrl,
      variants,
      userId
    } = req.body;
    const updated = db.products.update(id, {
      name,
      description,
      sku,
      barcode,
      unitOfMeasure,
      isService: !!isService,
      categoryId,
      taxId,
      priceCUP: Number(priceCUP) || 0,
      priceMLC: Number(priceMLC) || 0,
      costCUP: Number(costCUP) || 0,
      costMLC: Number(costMLC) || 0,
      imageUrl
    });
    if (!updated) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    if (variants && Array.isArray(variants)) {
      db.variants.deleteByProductId(id);
      variants.forEach((v) => {
        db.variants.create({
          productId: id,
          name: v.name,
          sku: v.sku || "",
          barcode: v.barcode || "",
          priceCUP: Number(v.priceCUP) || 0,
          priceMLC: Number(v.priceMLC) || 0,
          costCUP: Number(v.costCUP) || 0,
          costMLC: Number(v.costMLC) || 0,
          stock: Number(v.stock) || 0
        });
      });
    }
    const auditUserId = userId || req.user?.userId;
    if (auditUserId) {
      logAudit(auditUserId, "UPDATE", "Product", id, `Updated product ${name}`);
    }
    return res.json(updated);
  });
  app.get("/api/categories", (_req, res) => {
    return res.json(db.categories.findMany());
  });
  app.post("/api/categories", (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: "Nombre es requerido" });
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const item = db.categories.create({ name, slug, parentId });
    return res.json(item);
  });
  app.get("/api/inventario", (_req, res) => {
    const stocks = db.stocks.findMany();
    const products = db.products.findMany();
    const variants = db.variants.findMany();
    const warehouses = db.warehouses.findMany();
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
      transfers: db.transfers.findMany().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    });
  });
  app.post("/api/inventario/movimiento", authenticate, (req, res) => {
    const { stockId, type, quantity, reason, userId } = req.body;
    if (!stockId || !type || quantity === void 0) {
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
      userId: userId || req.user.userId
    });
    const auditUserId = userId || req.user.userId;
    logAudit(auditUserId, "STOCK_MOVEMENT", "Stock", stockId, `Registered ${type} of ${qtyChange} units. Reason: ${reason}`);
    return res.json(mov);
  });
  app.post("/api/inventario/transferencia", authenticate, (req, res) => {
    const { fromWarehouseId, toWarehouseId, items, userId } = req.body;
    if (!fromWarehouseId || !toWarehouseId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Par\xE1metros inv\xE1lidos" });
    }
    const transfer = db.transfers.create({
      fromWarehouseId,
      toWarehouseId,
      status: "completada",
      items,
      createdBy: userId || req.user.userId
    });
    const stocks = db.stocks.findMany();
    items.forEach((item) => {
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
          reason: `Transferencia enviada a almac\xE9n ${toWarehouseId}`,
          userId: userId || req.user.userId
        });
      }
      if (!destStock) {
        destStock = db.stocks.create({
          productId: item.productId,
          variantId: item.variantId,
          warehouseId: toWarehouseId,
          quantity: 0,
          minStock: 5,
          maxStock: 9999
        });
      }
      db.stocks.update(destStock.id, { quantity: destStock.quantity + qty });
      db.stockMovements.create({
        stockId: destStock.id,
        type: "transferencia",
        quantity: qty,
        reason: `Transferencia recibida de almac\xE9n ${fromWarehouseId}`,
        userId: userId || req.user.userId
      });
    });
    const auditUserId = userId || req.user.userId;
    logAudit(auditUserId, "TRANSFER", "Warehouse", fromWarehouseId, `Transferred items to warehouse ${toWarehouseId}`);
    return res.json(transfer);
  });
  app.get("/api/pos/sessions", (_req, res) => {
    const sessions = db.cashRegisterSessions.findMany();
    return res.json(sessions);
  });
  app.post("/api/pos/sessions/start", authenticate, (req, res) => {
    const { branchId, initialCash, userId } = req.body;
    const session = db.cashRegisterSessions.create({
      branchId,
      userId: userId || req.user.userId,
      initialCash: Number(initialCash) || 0,
      status: "open"
    });
    return res.json(session);
  });
  app.post("/api/pos/sessions/close", authenticate, (req, res) => {
    const { sessionId, countedCash, expectedCash } = req.body;
    const session = db.cashRegisterSessions.update(sessionId, {
      status: "closed",
      endDate: (/* @__PURE__ */ new Date()).toISOString(),
      countedCash: Number(countedCash) || 0,
      expectedCash: Number(expectedCash) || 0
    });
    return res.json(session);
  });
  app.get("/api/sales", (_req, res) => {
    const sales = db.sales.findMany();
    const customers = db.customers.findMany();
    const detailed = sales.map((s) => ({
      ...s,
      customer: customers.find((c) => c.id === s.customerId) || null,
      items: db.saleItems.findMany().filter((i) => i.saleId === s.id)
    }));
    return res.json(detailed);
  });
  app.post("/api/sales", authenticate, async (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const {
      branchId,
      customerId,
      items,
      totalCUP,
      totalMLC,
      taxTotalCUP,
      taxTotalMLC,
      discount,
      grandTotalCUP,
      grandTotalMLC,
      paymentMethod,
      payments,
      userId,
      isCredit,
      loyaltyPointsRedeemed
    } = parsed.data;
    const sale = db.sales.create({
      branchId,
      customerId: customerId || void 0,
      date: (/* @__PURE__ */ new Date()).toISOString(),
      totalCUP: Number(totalCUP) || 0,
      totalMLC: Number(totalMLC) || 0,
      taxTotalCUP: Number(taxTotalCUP) || 0,
      taxTotalMLC: Number(taxTotalMLC) || 0,
      discount: Number(discount) || 0,
      grandTotalCUP: Number(grandTotalCUP) || 0,
      grandTotalMLC: Number(grandTotalMLC) || 0,
      paymentMethod: paymentMethod || "efectivo",
      status: "completed",
      userId: userId || req.user.userId
    });
    const stocks = db.stocks.findMany();
    const branchWarehouse = db.warehouses.findMany().find((w) => w.branchId === branchId);
    items.forEach((item) => {
      db.saleItems.create({
        saleId: sale.id,
        productId: item.productId,
        variantId: item.variantId || void 0,
        quantity: Number(item.quantity),
        unitPriceCUP: Number(item.priceCUP) || 0,
        unitPriceMLC: Number(item.priceMLC) || 0,
        tax: Number(item.tax) || 0,
        discount: Number(item.discount) || 0
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
            userId: userId || req.user.userId
          });
        }
      }
    });
    if (payments && Array.isArray(payments)) {
      payments.forEach((p) => {
        db.payments.create({
          saleId: sale.id,
          method: p.method || paymentMethod,
          currency: p.currency || "CUP" /* CUP */,
          amount: Number(p.amount),
          reference: p.reference || void 0
        });
      });
    } else {
      db.payments.create({
        saleId: sale.id,
        method: paymentMethod || "efectivo",
        currency: (grandTotalMLC || 0) > 0 ? "MLC" /* MLC */ : "CUP" /* CUP */,
        amount: (grandTotalMLC || 0) > 0 ? grandTotalMLC || 0 : grandTotalCUP || 0,
        reference: paymentMethod !== "efectivo" ? `REF-${Math.floor(Math.random() * 9e5) + 1e5}` : void 0
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
      status: "posted"
    });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: Number(grandTotalCUP) || 0, credit: 0 });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: 0, credit: Number(grandTotalCUP) || 0 });
    const auditUserId = userId || req.user.userId;
    logAudit(auditUserId, "CREATE_SALE", "Sale", sale.id, `Completed sale of ${grandTotalCUP} CUP`);
    return res.json(sale);
  });
  app.post("/api/sales/:id/refund", authenticate, (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const sale = db.sales.findById(id);
    if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
    db.sales.update(id, { status: "refunded" });
    const items = db.saleItems.findMany().filter((i) => i.saleId === id);
    const branchWarehouse = db.warehouses.findMany().find((w) => w.branchId === sale.branchId);
    const stocks = db.stocks.findMany();
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
            reason: `Devoluci\xF3n Venta ${id}`,
            userId: userId || req.user.userId
          });
        }
      });
    }
    const entry = db.journalEntries.create({
      description: `Reverso de Venta ${id}`,
      reference: id,
      status: "posted"
    });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: Number(sale.grandTotalCUP), credit: 0 });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: Number(sale.grandTotalCUP) });
    const auditUserId = userId || req.user?.userId;
    if (auditUserId) {
      logAudit(auditUserId, "REFUND_SALE", "Sale", id, `Refunded sale ${id}`);
    }
    return res.json({ success: true });
  });
  app.get("/api/orders", (_req, res) => {
    const orders = db.orders.findMany();
    const customers = db.customers.findMany();
    const detailed = orders.map((o) => ({
      ...o,
      customer: customers.find((c) => c.id === o.customerId) || null,
      items: db.orderItems.findMany().filter((i) => i.orderId === o.id)
    }));
    return res.json(detailed);
  });
  app.post("/api/orders", (req, res) => {
    const { branchId, customerId, items, deliveryDate, totalCUP, totalMLC, notes, deliveryAddress, assignedDriverId, advancePayment } = req.body;
    const order = db.orders.create({
      branchId,
      customerId,
      deliveryDate,
      status: "pending",
      totalCUP: Number(totalCUP) || 0,
      totalMLC: Number(totalMLC) || 0,
      notes: notes || "",
      deliveryAddress: deliveryAddress || "",
      assignedDriverId: assignedDriverId || "",
      advancePayment: Number(advancePayment) || 0
    });
    if (items && Array.isArray(items)) {
      items.forEach((item) => {
        db.orderItems.create({
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId || void 0,
          quantity: Number(item.quantity),
          unitPriceCUP: Number(item.priceCUP) || 0,
          unitPriceMLC: Number(item.priceMLC) || 0
        });
      });
    }
    return res.json(order);
  });
  app.put("/api/orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, assignedDriverId } = req.body;
    const order = db.orders.update(id, { status, assignedDriverId });
    return res.json(order);
  });
  app.get("/api/compras", (_req, res) => {
    const suppliers = db.suppliers.findMany();
    const purchaseOrders = db.purchaseOrders.findMany();
    const items = db.purchaseOrderItems.findMany();
    const invoices = db.supplierInvoices.findMany();
    const products = db.products.findMany();
    const detailedOrders = purchaseOrders.map((po) => {
      const sup = suppliers.find((s) => s.id === po.supplierId);
      const poItems = items.filter((i) => i.purchaseOrderId === po.id).map((i) => ({ ...i, product: products.find((p) => p.id === i.productId) }));
      return { ...po, supplier: sup, items: poItems };
    });
    const detailedInvoices = invoices.map((inv) => ({ ...inv, supplier: suppliers.find((s) => s.id === inv.supplierId) }));
    return res.json({ suppliers, purchaseOrders: detailedOrders, invoices: detailedInvoices });
  });
  app.post("/api/compras/suppliers", (req, res) => {
    const { name, contact, taxId, email, phone, address, paymentTerms } = req.body;
    const item = db.suppliers.create({ name, contact, taxId, email, phone, address, paymentTerms });
    return res.json(item);
  });
  app.post("/api/compras/orders", (req, res) => {
    const { supplierId, warehouseId, notes, createdBy, items } = req.body;
    const po = db.purchaseOrders.create({
      supplierId,
      warehouseId,
      status: "draft",
      notes,
      orderDate: (/* @__PURE__ */ new Date()).toISOString().substring(0, 10),
      createdBy: createdBy || "admin"
    });
    if (items && Array.isArray(items)) {
      items.forEach((item) => {
        db.purchaseOrderItems.create({
          purchaseOrderId: po.id,
          productId: item.productId,
          variantId: item.variantId || void 0,
          quantity: Number(item.quantity),
          unitCostCUP: Number(item.costCUP) || 0,
          unitCostMLC: Number(item.costMLC) || 0,
          receivedQty: 0
        });
      });
    }
    return res.json(po);
  });
  app.post("/api/compras/orders/:id/receive", authenticate, (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const po = db.purchaseOrders.update(id, { status: "received" });
    if (!po) return res.status(404).json({ error: "Orden no encontrada" });
    const poItems = db.purchaseOrderItems.findMany().filter((i) => i.purchaseOrderId === id);
    const stocks = db.stocks.findMany();
    let totalCUP = 0;
    let totalMLC = 0;
    poItems.forEach((poi) => {
      db.purchaseOrderItems.update(poi.id, { receivedQty: poi.quantity });
      let matchingStock = stocks.find((s) => s.warehouseId === po.warehouseId && s.productId === poi.productId && (!poi.variantId || s.variantId === poi.variantId));
      if (!matchingStock) {
        matchingStock = db.stocks.create({ productId: poi.productId, variantId: poi.variantId, warehouseId: po.warehouseId, quantity: 0, minStock: 5, maxStock: 9999 });
      }
      db.stocks.update(matchingStock.id, { quantity: matchingStock.quantity + poi.quantity });
      db.stockMovements.create({ stockId: matchingStock.id, type: "entrada", quantity: poi.quantity, reason: `Recepci\xF3n Orden Compra ${id}`, userId: userId || req.user.userId });
      totalCUP += poi.quantity * poi.unitCostCUP;
      totalMLC += poi.quantity * poi.unitCostMLC;
    });
    db.supplierInvoices.create({ supplierId: po.supplierId, purchaseOrderId: po.id, totalCUP, totalMLC, paidAmountCUP: 0, paidAmountMLC: 0, status: "pendiente" });
    const entry = db.journalEntries.create({ description: `Recepci\xF3n Orden de Compra ${id}`, reference: id, status: "posted" });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1040", debit: totalCUP, credit: 0 });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "2010", debit: 0, credit: totalCUP });
    const auditUserId = userId || req.user.userId;
    logAudit(auditUserId, "RECEIVE_PURCHASE", "PurchaseOrder", id, `Received purchase order ${id} with total ${totalCUP} CUP`);
    return res.json(po);
  });
  app.post("/api/compras/invoices/:id/pay", authenticate, (req, res) => {
    const { id } = req.params;
    const { amountCUP, amountMLC, userId } = req.body;
    const inv = db.supplierInvoices.findMany().find((x) => x.id === id);
    if (!inv) return res.status(404).json({ error: "Factura no encontrada" });
    const updatedPaidCUP = inv.paidAmountCUP + (Number(amountCUP) || 0);
    const updatedPaidMLC = inv.paidAmountMLC + (Number(amountMLC) || 0);
    const status = updatedPaidCUP >= inv.totalCUP ? "pagada" : "pendiente";
    const updated = db.supplierInvoices.update(id, { paidAmountCUP: updatedPaidCUP, paidAmountMLC: updatedPaidMLC, status });
    const entry = db.journalEntries.create({ description: `Pago Factura Proveedor ${id}`, reference: id, status: "posted" });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "2010", debit: Number(amountCUP) || 0, credit: 0 });
    db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: Number(amountCUP) || 0 });
    return res.json(updated);
  });
  app.get("/api/clientes", (_req, res) => {
    return res.json(db.customers.findMany());
  });
  app.post("/api/clientes", (req, res) => {
    const { name, email, phone, address, taxId, creditLimit } = req.body;
    const client = db.customers.create({
      name,
      email: email || "",
      phone: phone || "",
      address: address || "",
      taxId: taxId || "",
      creditLimit: Number(creditLimit) || 0,
      currentBalance: 0,
      loyaltyPoints: 0
    });
    return res.json(client);
  });
  app.put("/api/clientes/:id", (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address, taxId, creditLimit, loyaltyPoints } = req.body;
    const updated = db.customers.update(id, {
      name,
      email,
      phone,
      address,
      taxId,
      creditLimit: creditLimit !== void 0 ? Number(creditLimit) : void 0,
      loyaltyPoints: loyaltyPoints !== void 0 ? Number(loyaltyPoints) : void 0
    });
    return res.json(updated);
  });
  app.post("/api/clientes/campana", authenticate, (req, res) => {
    const { name, message, customerIds } = req.body;
    logAudit(req.user.userId, "SEND_CAMPAIGN", "Customer", "multiple", `Sent campaign '${name}' to ${customerIds ? customerIds.length : 0} customers. Message: ${message}`);
    return res.json({ success: true, logged: true });
  });
  app.get("/api/produccion", (_req, res) => {
    const recipes = db.recipes.findMany();
    const ingredients = db.recipeIngredients.findMany();
    const productionOrders = db.productionOrders.findMany();
    const products = db.products.findMany();
    const warehouses = db.warehouses.findMany();
    const detailedRecipes = recipes.map((r) => {
      const rIngs = ingredients.filter((i) => i.recipeId === r.id).map((i) => ({ ...i, ingredientProduct: products.find((p) => p.id === i.ingredientProductId) }));
      return { ...r, product: products.find((p) => p.id === r.productId), ingredients: rIngs };
    });
    const detailedOrders = productionOrders.map((po) => ({
      ...po,
      product: products.find((p) => p.id === po.productId),
      recipe: recipes.find((r) => r.id === po.recipeId),
      warehouse: warehouses.find((w) => w.id === po.warehouseId)
    }));
    return res.json({ recipes: detailedRecipes, productionOrders: detailedOrders });
  });
  app.post("/api/produccion/recipes", (req, res) => {
    const { name, productId, yieldQuantity, yieldUnit, ingredients } = req.body;
    const rec = db.recipes.create({ name, productId, yieldQuantity: Number(yieldQuantity) || 1, yieldUnit: yieldUnit || "pieza" });
    if (ingredients && Array.isArray(ingredients)) {
      ingredients.forEach((ing) => {
        db.recipeIngredients.create({ recipeId: rec.id, ingredientProductId: ing.ingredientProductId, quantity: Number(ing.quantity), unit: ing.unit || "kg", wastePercent: Number(ing.wastePercent) || 0 });
      });
    }
    return res.json(rec);
  });
  app.delete("/api/produccion/recipes/:id", (req, res) => {
    const { id } = req.params;
    db.recipeIngredients.deleteByRecipeId(id);
    db.recipes.delete(id);
    return res.json({ success: true });
  });
  app.post("/api/produccion/orders", (req, res) => {
    const { productId, recipeId, plannedQuantity, warehouseId, notes } = req.body;
    const order = db.productionOrders.create({ productId, recipeId: recipeId || void 0, plannedQuantity: Number(plannedQuantity), producedQuantity: 0, status: "planned", warehouseId, notes: notes || "" });
    return res.json(order);
  });
  app.post("/api/produccion/orders/:id/start", authenticate, (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const order = db.productionOrders.findMany().find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: "Orden de producci\xF3n no encontrada" });
    db.productionOrders.update(id, { status: "in_progress", startDate: (/* @__PURE__ */ new Date()).toISOString() });
    if (order.recipeId) {
      const ingredients = db.recipeIngredients.findMany().filter((i) => i.recipeId === order.recipeId);
      const stocks = db.stocks.findMany();
      ingredients.forEach((ing) => {
        const requiredQty = ing.quantity * order.plannedQuantity * (1 + ing.wastePercent / 100);
        const matchingStock = stocks.find((s) => s.warehouseId === order.warehouseId && s.productId === ing.ingredientProductId);
        if (matchingStock) {
          db.stocks.update(matchingStock.id, { quantity: Math.max(0, matchingStock.quantity - requiredQty) });
          db.stockMovements.create({ stockId: matchingStock.id, type: "salida", quantity: requiredQty, reason: `Consumo ingredientes Orden Producci\xF3n ${id}`, userId: userId || req.user.userId });
        }
      });
    }
    return res.json({ success: true });
  });
  app.post("/api/produccion/orders/:id/complete", authenticate, (req, res) => {
    const { id } = req.params;
    const { producedQuantity, userId } = req.body;
    const order = db.productionOrders.findMany().find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: "Orden de producci\xF3n no encontrada" });
    const qty = Number(producedQuantity) || order.plannedQuantity;
    db.productionOrders.update(id, { status: "completed", endDate: (/* @__PURE__ */ new Date()).toISOString(), producedQuantity: qty });
    const stocks = db.stocks.findMany();
    let finishedStock = stocks.find((s) => s.warehouseId === order.warehouseId && s.productId === order.productId);
    if (!finishedStock) {
      finishedStock = db.stocks.create({ productId: order.productId, warehouseId: order.warehouseId, quantity: 0, minStock: 5, maxStock: 9999 });
    }
    db.stocks.update(finishedStock.id, { quantity: finishedStock.quantity + qty });
    db.stockMovements.create({ stockId: finishedStock.id, type: "entrada", quantity: qty, reason: `Producci\xF3n de orden terminada ${id}`, userId: userId || req.user.userId });
    return res.json({ success: true });
  });
  app.get("/api/finanzas", (_req, res) => {
    const accounts = db.accounts.findMany();
    const journalEntries = db.journalEntries.findMany();
    const lines = db.journalEntryLines.findMany();
    const trans = db.cashRegisterTransactions.findMany();
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
        lines: lines.filter((l) => l.journalEntryId === je.id).map((l) => ({ ...l, account: accounts.find((a) => a.id === l.accountId) }))
      })),
      transactions: trans
    });
  });
  app.post("/api/finanzas/transactions", authenticate, (req, res) => {
    const { type, amount, currency, description, category, userId } = req.body;
    if (!type || !amount) return res.status(400).json({ error: "Campos requeridos vac\xEDos" });
    const trans = db.cashRegisterTransactions.create({
      type,
      amount: Number(amount),
      currency: currency || "CUP" /* CUP */,
      description: description || "",
      category: category || "General",
      userId: userId || req.user.userId
    });
    const entry = db.journalEntries.create({ description: `Transacci\xF3n Caja No Operativa: ${description}`, reference: trans.id, status: "posted" });
    const isIncome = type === "income";
    const amt = Number(amount);
    if (isIncome) {
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: amt, credit: 0 });
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "4010", debit: 0, credit: amt });
    } else {
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "5030", debit: amt, credit: 0 });
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: amt });
    }
    return res.json(trans);
  });
  app.get("/api/rrhh", (_req, res) => {
    const employees = db.employees.findMany();
    const attendances = db.attendances.findMany();
    const periods = db.payrollPeriods.findMany();
    const details = db.payrollDetails.findMany();
    const detailedEmployees = employees.map((emp) => ({ ...emp, attendances: attendances.filter((a) => a.employeeId === emp.id) }));
    const detailedPeriods = periods.map((p) => ({
      ...p,
      details: details.filter((d) => d.payrollPeriodId === p.id).map((d) => ({ ...d, employee: employees.find((e) => e.id === d.employeeId) }))
    }));
    return res.json({ employees: detailedEmployees, periods: detailedPeriods });
  });
  app.post("/api/rrhh/employees", (req, res) => {
    const { firstName, lastName, hireDate, baseSalary, paymentType, bankAccount, taxId, socialSecurityNumber } = req.body;
    const emp = db.employees.create({
      firstName,
      lastName,
      hireDate: hireDate || (/* @__PURE__ */ new Date()).toISOString().substring(0, 10),
      baseSalary: Number(baseSalary) || 0,
      paymentType: paymentType || "salary",
      bankAccount: bankAccount || "",
      taxId: taxId || "",
      socialSecurityNumber: socialSecurityNumber || "",
      vacationDays: 24
    });
    return res.json(emp);
  });
  app.post("/api/rrhh/attendance", (req, res) => {
    const { employeeId, date, checkIn, checkOut } = req.body;
    const inTime = checkIn ? /* @__PURE__ */ new Date(`${date}T${checkIn}:00Z`) : null;
    const outTime = checkOut ? /* @__PURE__ */ new Date(`${date}T${checkOut}:00Z`) : null;
    let hoursWorked = 0;
    if (inTime && outTime) {
      hoursWorked = (outTime.getTime() - inTime.getTime()) / (1e3 * 60 * 60);
    }
    const att = db.attendances.create({
      employeeId,
      date,
      checkIn: checkIn ? `${date}T${checkIn}:00.000Z` : void 0,
      checkOut: checkOut ? `${date}T${checkOut}:00.000Z` : void 0,
      hoursWorked: hoursWorked > 0 ? Number(hoursWorked.toFixed(2)) : void 0
    });
    return res.json(att);
  });
  app.post("/api/rrhh/payroll", authenticate, (req, res) => {
    const { startDate, endDate, employeeAdjustments } = req.body;
    const period = db.payrollPeriods.create({ startDate, endDate, status: "draft" });
    const employees = db.employees.findMany();
    employees.forEach((emp) => {
      const adj = employeeAdjustments ? employeeAdjustments[emp.id] : null;
      const base = emp.baseSalary;
      const overtime = adj ? Number(adj.overtime) || 0 : 0;
      const bonuses = adj ? Number(adj.bonuses) || 0 : 0;
      const deductions = adj ? Number(adj.deductions) || 0 : 0;
      const netPay = base + overtime + bonuses - deductions;
      db.payrollDetails.create({ payrollPeriodId: period.id, employeeId: emp.id, baseAmount: base, overtime, bonuses, deductions, netPay });
      const entry = db.journalEntries.create({ description: `Gasto N\xF3mina Empleado: ${emp.firstName} ${emp.lastName}`, reference: period.id, status: "posted" });
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "5020", debit: netPay, credit: 0 });
      db.journalEntryLines.create({ journalEntryId: entry.id, accountId: "1010", debit: 0, credit: netPay });
    });
    return res.json(period);
  });
  app.get("/api/configuracion", authenticate, (_req, res) => {
    const settings = db.systemSettings.findMany();
    const logs = db.auditLogs.findMany().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
    return res.json({ settings, logs, users: db.users.findMany() });
  });
  app.post("/api/configuracion", authenticate, (req, res) => {
    const { settings, userId } = req.body;
    if (settings && typeof settings === "object") {
      Object.keys(settings).forEach((key) => {
        db.systemSettings.setValue(key, String(settings[key]));
      });
      logAudit(userId || req.user.userId, "UPDATE_SETTINGS", "SystemSetting", "all", JSON.stringify(settings));
    }
    return res.json({ success: true });
  });
  app.get("/api/reportes/onat", (_req, res) => {
    const { month, year } = _req.query;
    const m = month ? Number(month) : (/* @__PURE__ */ new Date()).getMonth() + 1;
    const y = year ? Number(year) : (/* @__PURE__ */ new Date()).getFullYear();
    const rate = Number(db.systemSettings.getValue("exchange_rate_mlc", "120"));
    const sales = db.sales.findMany();
    const inxs = db.cashRegisterTransactions.findMany();
    const pDetails = db.payrollDetails.findMany();
    const invoices = db.supplierInvoices.findMany();
    const reportLines = [];
    const isTargetMonth = (dateStr) => {
      const d = new Date(dateStr);
      return d.getMonth() + 1 === m && d.getFullYear() === y;
    };
    sales.forEach((s) => {
      if (isTargetMonth(s.date) && s.status === "completed") {
        const mlcConverted = s.grandTotalMLC * rate;
        reportLines.push({ fecha: s.date.substring(0, 10), concepto: `Ingresos Ventas (Venta POS ${s.id.substring(0, 8)})`, ingreso: s.grandTotalCUP + mlcConverted, gasto: 0 });
      }
    });
    inxs.forEach((t) => {
      if (isTargetMonth(t.date)) {
        const factor = t.currency === "MLC" /* MLC */ ? rate : 1;
        if (t.type === "income") {
          reportLines.push({ fecha: t.date.substring(0, 10), concepto: `Ingreso Caja: ${t.description}`, ingreso: t.amount * factor, gasto: 0 });
        } else {
          reportLines.push({ fecha: t.date.substring(0, 10), concepto: `Gasto Caja: ${t.description}`, ingreso: 0, gasto: t.amount * factor });
        }
      }
    });
    invoices.forEach((inv) => {
      const po = inv.purchaseOrderId ? db.purchaseOrders.findMany().find((p) => p.id === inv.purchaseOrderId) : null;
      const refDate = po ? po.createdAt : (/* @__PURE__ */ new Date()).toISOString();
      if (isTargetMonth(refDate)) {
        const mlcConverted = inv.totalMLC * rate;
        reportLines.push({ fecha: refDate.substring(0, 10), concepto: `Compra Proveedor (Factura ${inv.id.substring(0, 8)})`, ingreso: 0, gasto: inv.totalCUP + mlcConverted });
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
    console.log("Serving production static files from dist.");
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-Stack ERP/POS server running on port ${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
