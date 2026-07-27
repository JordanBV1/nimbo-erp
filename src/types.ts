/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Role {
  ADMIN = "ADMIN",
  GERENTE = "GERENTE",
  CAJERO = "CAJERO",
  BODEGA = "BODEGA",
  PRODUCCION = "PRODUCCION",
  CONTABLE = "CONTABLE",
  RRHH = "RRHH"
}

export enum BusinessType {
  BAKERY = "BAKERY",
  CAFETERIA = "CAFETERIA",
  WORKSHOP = "WORKSHOP",
  CLOTHING = "CLOTHING",
  ELECTRONICS = "ELECTRONICS",
  GROCERY = "GROCERY",
  PHARMACY = "PHARMACY",
  HARDWARE = "HARDWARE",
  BOOKSTORE = "BOOKSTORE",
  HOME_GOODS = "HOME_GOODS",
  BEAUTY = "BEAUTY",
  SERVICES = "SERVICES",
  GENERAL = "GENERAL"
}

export enum Currency {
  CUP = "CUP",
  MLC = "MLC"
}

export interface Organization {
  id: string;
  name: string;
  subscriptionStatus?: 'active' | 'pending' | 'expired';
  subscriptionExpiresAt?: string;
  lastPaymentDate?: string;
  paymentPlatform?: 'transfermovil' | 'enzona';
  paymentPhone?: string;
  paymentTxId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPayment {
  id: string;
  organizationId: string;
  amount: number;
  currency: Currency;
  platform: 'transfermovil' | 'enzona';
  phone?: string;
  transactionId: string;
  status: 'pending' | 'verified' | 'failed';
  date: string;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  address?: string;
  businessType: BusinessType;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  type: string; // "IVA", "exento", etc.
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unitOfMeasure: string;
  isService: boolean;
  categoryId?: string;
  taxId?: string;
  priceCUP: number;
  priceMLC: number;
  costCUP: number;
  costMLC: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  priceCUP: number;
  priceMLC: number;
  costCUP: number;
  costMLC: number;
  stock: number;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  branchId: string;
}

export interface Stock {
  id: string;
  productId: string;
  variantId?: string;
  warehouseId: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  lotNumber?: string;
  expirationDate?: string;
}

export interface StockMovement {
  id: string;
  stockId: string;
  type: "entrada" | "salida" | "ajuste" | "transferencia";
  quantity: number;
  reason?: string;
  userId: string;
  createdAt: string;
}

export interface Transfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: "pendiente" | "completada";
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>; // stored as JSON string in real DB, but we keep structured
  createdBy: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  warehouseId: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  orderDate: string;
  expectedDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitCostCUP: number;
  unitCostMLC: number;
  receivedQty: number;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  purchaseOrderId?: string;
  totalCUP: number;
  totalMLC: number;
  dueDate?: string;
  paidAmountCUP: number;
  paidAmountMLC: number;
  status: "pendiente" | "pagada";
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  creditLimit: number;
  currentBalance: number;
  loyaltyPoints: number;
}

export interface Sale {
  id: string;
  branchId: string;
  customerId?: string;
  date: string;
  totalCUP: number;
  totalMLC: number;
  taxTotalCUP: number;
  taxTotalMLC: number;
  discount: number;
  grandTotalCUP: number;
  grandTotalMLC: number;
  paymentMethod: string; // "efectivo", "Transfermóvil", "Enzona", "tarjeta", etc.
  status: "completed" | "refunded";
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceCUP: number;
  unitPriceMLC: number;
  tax: number;
  discount: number;
}

export interface Payment {
  id: string;
  saleId: string;
  method: string; // "efectivo", "Transfermóvil", "Enzona", "tarjeta"
  currency: Currency;
  amount: number;
  reference?: string;
  createdAt: string;
}

export interface CashRegisterSession {
  id: string;
  branchId: string;
  userId: string;
  startDate: string;
  endDate?: string;
  initialCash: number;
  expectedCash?: number;
  countedCash?: number;
  status: "open" | "closed";
}

export interface Order {
  id: string;
  branchId: string;
  customerId?: string;
  orderDate: string;
  deliveryDate?: string;
  status: "pending" | "preparing" | "ready" | "delivered" | "cancelled";
  totalCUP: number;
  totalMLC: number;
  notes?: string;
  deliveryAddress?: string;
  assignedDriverId?: string;
  advancePayment: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceCUP: number;
  unitPriceMLC: number;
}

export interface Recipe {
  id: string;
  name: string;
  productId: string;
  yieldQuantity: number;
  yieldUnit: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientProductId: string;
  quantity: number;
  unit: string;
  wastePercent: number;
}

export interface ProductionOrder {
  id: string;
  productId: string;
  recipeId?: string;
  plannedQuantity: number;
  producedQuantity: number;
  status: "planned" | "in_progress" | "completed";
  startDate?: string;
  endDate?: string;
  warehouseId: string;
  notes?: string;
}

export interface Account {
  id: string; // ID / Code
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
}

export interface JournalEntry {
  id: string;
  date: string;
  description?: string;
  reference?: string;
  status: "draft" | "posted";
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
}

export interface CashRegisterTransaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: Currency;
  description?: string;
  category?: string;
  date: string;
  userId: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  hireDate: string;
  baseSalary: number;
  paymentType: "hourly" | "salary";
  bankAccount?: string;
  taxId?: string;
  socialSecurityNumber?: string;
  vacationDays: number;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
}

export interface PayrollPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: "draft" | "approved";
}

export interface PayrollDetail {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  baseAmount: number;
  overtime: number;
  bonuses: number;
  deductions: number;
  netPay: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: string;
  createdAt: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
}

// Client visibility configuration config
export const MODULE_VISIBILITY: Record<BusinessType, string[]> = {
  BAKERY: ['pos', 'inventario', 'compras', 'pedidos', 'produccion', 'recetas', 'reportes', 'clientes', 'configuracion'],
  CAFETERIA: ['pos', 'pedidos', 'inventario', 'compras', 'clientes', 'reportes', 'configuracion'],
  WORKSHOP: ['produccion', 'inventario', 'compras', 'ventas', 'reportes', 'clientes', 'configuracion'],
  CLOTHING: ['pos', 'inventario', 'compras', 'clientes', 'ventas', 'pedidos', 'reportes', 'configuracion'],
  ELECTRONICS: ['pos', 'inventario', 'compras', 'clientes', 'ventas', 'reportes', 'configuracion'],
  GROCERY: ['pos', 'inventario', 'compras', 'reportes', 'clientes', 'configuracion'],
  PHARMACY: ['pos', 'inventario', 'compras', 'clientes', 'reportes', 'configuracion'],
  HARDWARE: ['pos', 'inventario', 'compras', 'ventas', 'clientes', 'reportes', 'configuracion'],
  BOOKSTORE: ['pos', 'inventario', 'compras', 'ventas', 'clientes', 'pedidos', 'reportes', 'configuracion'],
  HOME_GOODS: ['pos', 'inventario', 'compras', 'ventas', 'clientes', 'pedidos', 'reportes', 'configuracion'],
  BEAUTY: ['pos', 'pedidos', 'clientes', 'inventario', 'compras', 'reportes', 'configuracion'],
  SERVICES: ['ventas', 'clientes', 'compras', 'reportes', 'rrhh', 'configuracion'],
  GENERAL: ['pos', 'inventario', 'compras', 'ventas', 'clientes', 'produccion', 'recetas', 'pedidos', 'rrhh', 'finanzas', 'reportes', 'configuracion']
};
