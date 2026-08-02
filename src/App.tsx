/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Users,
  Package,
  Boxes,
  ShoppingCart,
  ClipboardList,
  ShoppingBag,
  Factory,
  DollarSign,
  Contact,
  BarChart3,
  Settings,
  Sparkles,
  Search,
  Plus,
  ArrowRight,
  UserCheck,
  Building,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  ArrowLeftRight,
  TrendingDown,
  Trash2,
  Lock,
  Printer,
  X,
  CreditCard,
  Percent,
  Check,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import Sidebar from "./components/layout/Sidebar.js";
import Header from "./components/layout/Header.js";
import ProfileModal from "./components/layout/ProfileModal.js";
import DynamicDashboard from "./components/Dashboard/DynamicDashboard.js";
import ONATReport from "./components/Reports/ONATReport.js";
import { TransfermovilQRModal } from "./components/POS/TransfermovilQRModal.js";
import { TransfermovilSettings } from "./components/Settings/TransfermovilSettings.js";
import ExportData from "./components/Settings/ExportData.js";
import PricingLanding from "./components/landing/PricingLanding.js";
import LegalModal, { LegalDoc } from "./components/landing/LegalModal.js";
import OnboardingModal from "./components/layout/OnboardingModal.js";
import SupportModal from "./components/layout/SupportModal.js";
import UserManager from "./components/Users/UserManager.js";
import { offlineQueue } from "./utils/offlineQueue.js";
import { Role, BusinessType, Currency } from "./types.js";
import { jsPDF } from "jspdf";

// Token stored in memory (not localStorage) for security
let memoryToken: string | null = null;
export function getToken() { return memoryToken; }
export function setToken(t: string | null) { memoryToken = t; }

// Global handler: on 401 (expired/invalid session), clear session and return to login
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const res = await originalFetch(...args);
  const url = typeof args[0] === "string" ? args[0] : (args[0] as URL).pathname || "";
  if (res.status === 401 && !url.includes("/api/auth/login") && !url.includes("/api/auth/register")) {
    memoryToken = null;
    sessionStorage.clear();
    window.location.reload();
  }
  return res;
};

export default function App() {
  const onboardingCheckedRef = React.useRef<boolean>(false);
  // Authentication & Branch states (restored from sessionStorage only for non-sensitive metadata)
  const [user, setUser] = useState<any>(() => {
    const val = sessionStorage.getItem("nimbo_user_meta");
    return val ? JSON.parse(val) : null;
  });
  const [branch, setBranch] = useState<any>(() => {
    const val = sessionStorage.getItem("nimbo_branch");
    return val ? JSON.parse(val) : null;
  });
  const [org, setOrg] = useState<any>(() => {
    const val = sessionStorage.getItem("nimbo_org");
    return val ? JSON.parse(val) : null;
  });

  const [currentModule, setCurrentModule] = useState<string>("dashboard");
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [supportModalOpen, setSupportModalOpen] = useState<boolean>(false);
  const [isLanding, setIsLanding] = useState<boolean>(true);
  const [publicPricing, setPublicPricing] = useState<any>({ basePrice: 5000, perBranchPrice: 1000, currency: "CUP", businessName: "Nimbo ERP" });
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  // Registration & Login states
  const [emailInput, setEmailInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [regOrg, setRegOrg] = useState<string>("");
  const [regBranch, setRegBranch] = useState<string>("");
  const [regUser, setRegUser] = useState<string>("");
  const [regEmail, setRegEmail] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [regType, setRegType] = useState<BusinessType>(BusinessType.GENERAL);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>("");
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);
  const [newPasswordInput, setNewPasswordInput] = useState<string>("");

  // Subscription / Payment states
  const [paymentPlatform, setPaymentPlatform] = useState<"transfermovil" | "enzona">("transfermovil");
  const [paymentPhone, setPaymentPhone] = useState<string>("");
  const [paymentTxId, setPaymentTxId] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Core business data loaded from API
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [productionOrders, setProductionOrders] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(120);
  const [subscriptionPayments, setSubscriptionPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [transfermovilPhone, setTransfermovilPhone] = useState<string>("+53 51234567");
  const [enzonaUser, setEnzonaUser] = useState<string>("nimbo.erp");
  const [pricing, setPricing] = useState<{ basePrice: number; perBranchPrice: number; branchCount: number; totalPrice: number; currency: string }>({
    basePrice: 5000,
    perBranchPrice: 1000,
    branchCount: 1,
    totalPrice: 5000,
    currency: "CUP",
  });

  // POS / Cash Session States
  const [cashSession, setCashSession] = useState<any>(null);
  const [posCart, setPosCart] = useState<any[]>([]);
  const [posCustomer, setPosCustomer] = useState<string>("");
  const [posDiscount, setPosDiscount] = useState<number>(0);
  const [posPaymentMethod, setPosPaymentMethod] = useState<string>("efectivo");
  const [posCurrencyChoice, setPosCurrencyChoice] = useState<Currency>(Currency.CUP);
  const [posPaidAmount, setPosPaidAmount] = useState<string>("");
  const [posPointsRedeem, setPosPointsRedeem] = useState<number>(0);

  // Transfermovil QR Modal state
  const [posQRModalOpen, setPosQRModalOpen] = useState<boolean>(false);
  const [posQRPendingRef, setPosQRPendingRef] = useState<string>("");

  // Form toggles and temporary edit states
  const [showProductForm, setShowProductForm] = useState<boolean>(false);
  const [newProdName, setNewProdName] = useState<string>("");
  const [newProdSKU, setNewProdSKU] = useState<string>("");
  const [newProdBarcode, setNewProdBarcode] = useState<string>("");
  const [newProdUnit, setNewProdUnit] = useState<string>("pieza");
  const [newProdCat, setNewProdCat] = useState<string>("");
  const [newProdPriceCUP, setNewProdPriceCUP] = useState<string>("0");
  const [newProdPriceUSD, setNewProdPriceUSD] = useState<string>("0");
  const [newProdCostCUP, setNewProdCostCUP] = useState<string>("0");
  const [newProdCostUSD, setNewProdCostUSD] = useState<string>("0");
  const [newProdImage, setNewProdImage] = useState<string>("");
  const [newProdVariants, setNewProdVariants] = useState<any[]>([]);

  // New Supplier Form states
  const [showSupplierForm, setShowSupplierForm] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>("");
  const [newSupplierContact, setNewSupplierContact] = useState<string>("");

  // New Customer Form states
  const [showCustomerForm, setShowCustomerForm] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>("");
  const [newCustomerEmail, setNewCustomerEmail] = useState<string>("");
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>("");
  const [newCustomerCreditLimit, setNewCustomerCreditLimit] = useState<string>("0");

  // Toast / Status notification states
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const triggerToast = (msg: string, type: "success" | "error" | "info" | "warning" = "success") => {
    setToastMsg(msg);
    setToastType(type === "info" || type === "warning" ? "success" : type);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // 1. Data Refresh triggers from server
  const loadAllData = async () => {
    if (!user) return;
    try {
      // Products
      const resProds = await fetch("/api/products");
      if (resProds.ok) setProducts(await resProds.json());

      // Categories
      const resCats = await fetch("/api/categories");
      if (resCats.ok) setCategories(await resCats.json());

      // Inventory
      const resInv = await fetch("/api/inventario");
      if (resInv.ok) {
        const invData = await resInv.json();
        setStocks(invData.stocks);
        setWarehouses(invData.warehouses);
      }

      // Sales
      const resSales = await fetch("/api/sales");
      if (resSales.ok) setSales(await resSales.json());

      // Orders
      const resOrders = await fetch("/api/orders");
      if (resOrders.ok) setOrders(await resOrders.json());

      // Purchases & Suppliers
      const resComp = await fetch("/api/compras");
      if (resComp.ok) {
        const compData = await resComp.json();
        setSuppliers(compData.suppliers);
        setPurchaseOrders(compData.purchaseOrders);
        setInvoices(compData.invoices);
      }

      // Customers
      const resCust = await fetch("/api/clientes");
      if (resCust.ok) setCustomers(await resCust.json());

      // Production
      const resProd = await fetch("/api/produccion");
      if (resProd.ok) {
        const prodData = await resProd.json();
        setRecipes(prodData.recipes);
        setProductionOrders(prodData.productionOrders);
      }

      // Finances
      const resFin = await fetch("/api/finanzas");
      if (resFin.ok) {
        const finData = await resFin.json();
        setAccounts(finData.accounts);
        setJournalEntries(finData.journalEntries);
        setCashTransactions(finData.transactions);
      }

      // HR
      const resHr = await fetch("/api/rrhh");
      if (resHr.ok) {
        const hrData = await resHr.json();
        setEmployees(hrData.employees);
        setPeriods(hrData.periods);
      }

      // Configuration / Rate
      const resConf = await fetch("/api/configuracion");
      if (resConf.ok) {
        const confData = await resConf.json();
        setAuditLogs(confData.logs);
        const rateSetting = confData.settings.find((s: any) => s.key === "exchange_rate_usd");
        if (rateSetting) setExchangeRate(Number(rateSetting.value) || 120);
        const phoneSetting = confData.settings.find((s: any) => s.key === "transfermovil_phone");
        if (phoneSetting) setTransfermovilPhone(phoneSetting.value);
        const enzonaSetting = confData.settings.find((s: any) => s.key === "enzona_user");
        if (enzonaSetting) setEnzonaUser(enzonaSetting.value);
        if (!onboardingCheckedRef.current) {
          onboardingCheckedRef.current = true;
          const onboardingSetting = confData.settings.find((s: any) => s.key === "onboarding_done");
          if (!onboardingSetting || onboardingSetting.value !== "1") {
            setShowOnboarding(true);
          }
        }
      }

      // Sessions
      const resSessions = await fetch("/api/pos/sessions");
      if (resSessions.ok) {
        const sessList = await resSessions.json();
        const active = sessList.find((s: any) => s.status === "open" && s.userId === user.id);
        setCashSession(active || null);
      }

      // Refresh organization subscription status
      const savedOrg = localStorage.getItem("nimbo_org");
      if (savedOrg) {
        const parsedOrg = JSON.parse(savedOrg);
        if (parsedOrg && parsedOrg.id) {
          const resOrg = await fetch(`/api/auth/organization?orgId=${parsedOrg.id}`);
          if (resOrg.ok) {
            const freshOrg = await resOrg.json();
            setOrg(freshOrg);
            localStorage.setItem("nimbo_org", JSON.stringify(freshOrg));
          }
          await fetchSubscriptionPayments(parsedOrg.id);
          // Load branches for subscription pricing
          const resBranches = await fetch(`/api/branches?orgId=${parsedOrg.id}`);
          if (resBranches.ok) setBranches(await resBranches.json());
          // Load dynamic subscription pricing
          const resPricing = await fetch(`/api/subscription/pricing?orgId=${parsedOrg.id}`);
          if (resPricing.ok) {
            const p = await resPricing.json();
            setPricing({ basePrice: p.basePrice, perBranchPrice: p.perBranchPrice, branchCount: p.branchCount, totalPrice: p.totalPrice, currency: p.currency });
            if (p.transfermovilPhone) setTransfermovilPhone(p.transfermovilPhone);
            if (p.enzonaUser) setEnzonaUser(p.enzonaUser);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch fresh data from API server:", err);
    }
  };

  const fetchSubscriptionPayments = async (orgId?: string) => {
    const targetOrgId = orgId || org?.id;
    if (!targetOrgId) return;
    setIsLoadingPayments(true);
    try {
      const res = await fetch(`/api/subscription/payments?orgId=${targetOrgId}`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptionPayments(data);
      }
    } catch (err) {
      console.error("Failed to fetch subscription payments:", err);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  useEffect(() => {
    fetch("/api/public/pricing")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) setPublicPricing(p);
      })
      .catch(() => {});
  }, []);

  // Auth Operations
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        setBranch(data.branch);
        setOrg(data.organization);
        sessionStorage.setItem("nimbo_user_meta", JSON.stringify(data.user));
        sessionStorage.setItem("nimbo_branch", JSON.stringify(data.branch));
        sessionStorage.setItem("nimbo_org", JSON.stringify(data.organization));
        triggerToast("Sesión iniciada correctamente", "success");
      } else {
        const err = await res.json();
        setAuthError(err.error || "Credenciales incorrectas");
      }
    } catch {
      setAuthError("No se pudo conectar con el servidor Express.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: regOrg,
          branchName: regBranch,
          userName: regUser,
          email: regEmail,
          password: regPassword,
          businessType: regType
        })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        setBranch(data.branch);
        setOrg(data.organization);
        sessionStorage.setItem("nimbo_user_meta", JSON.stringify(data.user));
        sessionStorage.setItem("nimbo_branch", JSON.stringify(data.branch));
        sessionStorage.setItem("nimbo_org", JSON.stringify(data.organization));
        setIsRegistering(false);
        triggerToast("Registro completado con éxito", "success");
      } else {
        const err = await res.json();
        setAuthError(err.error || "Error al registrar");
      }
    } catch {
      setAuthError("Fallo de conexión con el servidor.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setAuthError(null);
    setIsSendingReset(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail })
      });
      if (res.ok) {
        const data = await res.json();
        setAuthInfo(data.message || "Si el correo existe, recibirás un enlace.");
      } else {
        const err = await res.json();
        setAuthError(err.error || "Error al solicitar el restablecimiento");
      }
    } catch {
      setAuthError("Fallo de conexión con el servidor.");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleLogout = async () => {
    setToken(null);
    setUser(null);
    setBranch(null);
    setOrg(null);
    sessionStorage.removeItem("nimbo_user_meta");
    sessionStorage.removeItem("nimbo_branch");
    sessionStorage.removeItem("nimbo_org");
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    triggerToast("Sesión cerrada", "success");
  };

  const handleUserUpdated = (updatedUser: any) => {
    setUser(updatedUser);
    sessionStorage.setItem("nimbo_user_meta", JSON.stringify(updatedUser));
  };

  const handleOnboardingDone = async () => {
    setShowOnboarding(false);
    try {
      await fetch("/api/onboarding/dismiss", { method: "POST" });
    } catch { /* ignore */ }
    triggerToast("¡Listo! Ya puedes operar tu negocio", "success");
  };

  const isSubscriptionExpired = () => {
    if (!org) return false;
    if (org.subscriptionExpiresAt) {
      const expires = new Date(org.subscriptionExpiresAt);
      return new Date() > expires;
    }
    return org.subscriptionStatus === "expired";
  };

  const getSubscriptionDaysLeft = () => {
    if (!org || !org.subscriptionExpiresAt) return 0;
    const expires = new Date(org.subscriptionExpiresAt);
    const diffTime = expires.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const SUBSCRIPTION_BASE_PRICE = pricing.basePrice;
  const SUBSCRIPTION_PER_BRANCH_PRICE = pricing.perBranchPrice;
  const getTotalSubscriptionPrice = () =>
    SUBSCRIPTION_BASE_PRICE + Math.max(0, Math.max(pricing.branchCount, branches.length) - 1) * SUBSCRIPTION_PER_BRANCH_PRICE;

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTxId.trim()) {
      triggerToast("Debes ingresar el ID de transacción", "error");
      return;
    }
    setIsSubmittingPayment(true);
    try {
      const res = await fetch("/api/subscription/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          platform: paymentPlatform,
          phone: paymentPhone,
          transactionId: paymentTxId,
          amount: getTotalSubscriptionPrice(),
          userId: user.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        setOrg(data.organization);
        localStorage.setItem("nimbo_org", JSON.stringify(data.organization));
        triggerToast("¡Suscripción activada/renovada con éxito!", "success");
        setPaymentTxId("");
        setPaymentPhone("");
        await fetchSubscriptionPayments(data.organization.id);
      } else {
        const err = await res.json();
        triggerToast(err.error || "Error al procesar el pago", "error");
      }
    } catch {
      triggerToast("Fallo de conexión al enviar el pago.", "error");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // POS operations
  const startCashSession = async (initial: number) => {
    try {
      const res = await fetch("/api/pos/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branch.id, initialCash: initial, userId: user.id })
      });
      if (res.ok) {
        setCashSession(await res.json());
        triggerToast("Caja abierta correctamente", "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const closeCashSession = async (counted: number, expected: number) => {
    if (!cashSession) return;
    try {
      const res = await fetch("/api/pos/sessions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: cashSession.id, countedCash: counted, expectedCash: expected })
      });
      if (res.ok) {
        setCashSession(null);
        triggerToast("Caja cerrada correctamente", "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPosCart = (prod: any, variant?: any) => {
    const existingIdx = posCart.findIndex(
      (item) => item.productId === prod.id && (!variant || item.variantId === variant.id)
    );

    if (existingIdx !== -1) {
      const updated = [...posCart];
      updated[existingIdx].quantity += 1;
      setPosCart(updated);
    } else {
      setPosCart([
        ...posCart,
        {
          productId: prod.id,
          variantId: variant?.id || null,
          name: prod.name + (variant ? ` (${variant.name})` : ""),
          priceCUP: variant ? variant.priceCUP : prod.priceCUP,
          priceUSD: variant ? variant.priceUSD : prod.priceUSD,
          tax: 0,
          discount: 0,
          quantity: 1
        }
      ]);
    }
  };

  const handleCheckout = async () => {
    if (posCart.length === 0) {
      triggerToast("El carrito está vacío", "error");
      return;
    }

    // Unify totals based on checkout Currency choice
    let totalCUP = 0;
    let totalUSD = 0;

    posCart.forEach((item) => {
      totalCUP += item.priceCUP * item.quantity;
      totalUSD += item.priceUSD * item.quantity;
    });

    const discAmt = Number(posDiscount) || 0;
    const finalCUP = Math.max(0, totalCUP - discAmt);
    const finalUSD = Math.max(0, totalUSD - (discAmt / exchangeRate));

    const checkoutPayload = {
      branchId: branch.id,
      customerId: posCustomer || undefined,
      items: posCart,
      totalCUP,
      totalUSD,
      taxTotalCUP: 0,
      taxTotalUSD: 0,
      discount: discAmt,
      grandTotalCUP: finalCUP,
      grandTotalUSD: finalUSD,
      paymentMethod: posPaymentMethod,
      userId: user.id,
      isCredit: posPaymentMethod === "credito"
    };

    // Client connection check
    if (!navigator.onLine) {
      // Offline fallback
      offlineQueue.enqueue("/api/sales", "POST", checkoutPayload);
      triggerToast("Guardado localmente en modo offline", "success");
      setPosCart([]);
      return;
    }

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload)
      });
      if (res.ok) {
        triggerToast("Venta realizada con éxito", "success");
        setPosCart([]);
        setPosDiscount(0);
        setPosCustomer("");
        loadAllData();
      } else {
        const err = await res.json();
        triggerToast(err.error || "Error al completar la venta", "error");
      }
    } catch {
      triggerToast("Fallo de conexión.", "error");
    }
  };

  // Products CRUD
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProdName,
          description: "",
          sku: newProdSKU,
          barcode: newProdBarcode,
          unitOfMeasure: newProdUnit,
          isService: false,
          categoryId: newProdCat,
          priceCUP: Number(newProdPriceCUP),
          priceUSD: Number(newProdPriceUSD),
          costCUP: Number(newProdCostCUP),
          costUSD: Number(newProdCostUSD),
          imageUrl: newProdImage,
          variants: newProdVariants,
          userId: user.id
        })
      });
      if (res.ok) {
        triggerToast("Producto creado correctamente", "success");
        setShowProductForm(false);
        // Clear forms
        setNewProdName("");
        setNewProdSKU("");
        setNewProdBarcode("");
        setNewProdPriceCUP("0");
        setNewProdPriceUSD("0");
        setNewProdVariants([]);
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Recipe Builder
  const [showRecipeForm, setShowRecipeForm] = useState<boolean>(false);
  const [recipeName, setRecipeName] = useState<string>("");
  const [recipeProd, setRecipeProd] = useState<string>("");
  const [recipeQty, setRecipeQty] = useState<string>("100");
  const [recipeUnit, setRecipeUnit] = useState<string>("pieza");
  const [recipeIngs, setRecipeIngs] = useState<any[]>([]);

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/produccion/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recipeName,
          productId: recipeProd,
          yieldQuantity: Number(recipeQty),
          yieldUnit: recipeUnit,
          ingredients: recipeIngs
        })
      });
      if (res.ok) {
        triggerToast("Receta creada con éxito", "success");
        setShowRecipeForm(false);
        setRecipeName("");
        setRecipeIngs([]);
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper dashboard metrics consolidator
  const getDashboardStats = () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const todaySales = sales.filter((s) => s.date.substring(0, 10) === todayStr && s.status === "completed");

    let todaySalesCUP = 0;
    let todaySalesUSD = 0;
    todaySales.forEach((s) => {
      todaySalesCUP += s.grandTotalCUP;
      todaySalesUSD += s.grandTotalUSD;
    });

    const stockAlerts = stocks.filter((s) => s.quantity < s.minStock).length;
    const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "preparing").length;
    const activeProductions = productionOrders.filter((po) => po.status === "in_progress").length;
    const frequentCustomers = customers.filter((c) => c.loyaltyPoints > 100).length;

    return {
      todaySalesCUP,
      todaySalesUSD,
      stockAlertsCount: stockAlerts,
      pendingOrdersCount: pendingOrders,
      activeProductionOrdersCount: activeProductions,
      frequentCustomersCount: frequentCustomers,
      inventoryValueCUP: stocks.reduce((sum, s) => sum + s.quantity * (s.product?.costCUP || 0), 0),
      totalEmployees: employees.length
    };
  };

  // Chart trending mock consolidator
  const getSalesChartData = () => {
    const last5Days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().substring(0, 10);
    }).reverse();

    return last5Days.map((day) => {
      const daySales = sales.filter((s) => s.date.substring(0, 10) === day && s.status === "completed");
      const totalCUP = daySales.reduce((sum, s) => sum + s.grandTotalCUP + (s.grandTotalUSD * exchangeRate), 0);
      return {
        fecha: day.substring(5), // MM-DD
        monto: totalCUP
      };
    });
  };

  // Monthly revenue comparison by currency
  const getMonthlyChartData = () => {
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const months: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: monthNames[d.getMonth()] });
    }
    return months.map((m) => {
      const monthSales = sales.filter((s) => s.status === "completed" && s.date.substring(0, 7) === m.key);
      const cup = monthSales.reduce((sum, s) => sum + (s.grandTotalCUP || 0), 0);
      const usd = monthSales.reduce((sum, s) => sum + (s.grandTotalUSD || 0), 0);
      return { month: m.label, cup, usd };
    });
  };

  // Top products unifier
  const getTopProductsData = () => {
    const map: Record<string, { name: string; sku: string; units: number; revenueCUP: number }> = {};
    sales.forEach((s) => {
      if (s.status !== "completed") return;
      s.items?.forEach((item: any) => {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return;
        if (!map[prod.id]) {
          map[prod.id] = { name: prod.name, sku: prod.sku || "", units: 0, revenueCUP: 0 };
        }
        map[prod.id].units += item.quantity;
        map[prod.id].revenueCUP += item.quantity * item.unitPriceCUP;
      });
    });

    return Object.values(map).sort((a, b) => b.units - a.units).slice(0, 5);
  };

  // Render Login screen if not authenticated
  const resetToken = new URLSearchParams(window.location.search).get("token");

  if (resetToken && !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl translate-x-12 translate-y-12"></div>
        <div className="w-full max-w-md bg-[#121214] border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-xl shadow-blue-500/5">
              <Lock className="h-7 w-7" />
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight font-display">Restablecer Contraseña</h2>
            <p className="text-xs text-slate-400">Ingresa tu nueva contraseña</p>
          </div>
          {authError && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
          {authInfo && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{authInfo}</span>
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthError(null);
              setAuthInfo(null);
              try {
                const res = await fetch("/api/auth/reset-password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token: resetToken, password: newPasswordInput })
                });
                const data = await res.json();
                if (res.ok) {
                  setAuthInfo(data.message || "Contraseña restablecida");
                  setTimeout(() => { window.location.href = "/"; }, 2000);
                } else {
                  setAuthError(data.error || "Error al restablecer la contraseña");
                }
              } catch {
                setAuthError("Fallo de conexión con el servidor.");
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nueva Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              Restablecer Contraseña
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl translate-x-12 translate-y-12"></div>

        {isLanding ? (
          <PricingLanding
            pricing={publicPricing}
            onLogin={() => { setIsLanding(false); setIsRegistering(false); setAuthError(null); setAuthInfo(null); }}
            onRegister={() => { setIsLanding(false); setIsRegistering(true); setAuthError(null); setAuthInfo(null); }}
          />
        ) : (
        <div className="w-full max-w-md bg-[#121214] border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-xl shadow-blue-500/5">
              <Building className="h-7 w-7" />
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight font-display">Nimbo ERP</h2>
            <p className="text-xs text-slate-400">Sistema de Gestión Empresarial</p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authInfo && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{authInfo}</span>
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Ingresa el correo de tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@negocio.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSendingReset}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                {isSendingReset ? "Enviando..." : "Enviar enlace de recuperación"}
              </button>
              <p className="text-xs text-slate-500 text-center">
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(false); setAuthError(null); setAuthInfo(null); }}
                  className="text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Volver a Iniciar Sesión
                </button>
              </p>
            </form>
          ) : !isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@negocio.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                Iniciar Sesión
              </button>
              <p className="text-xs text-slate-500 text-center">
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegistering(true); setAuthError(null); }}
                  className="text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Registrarse
                </button>
              </p>
              <p className="text-xs text-slate-500 text-center">
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(true); setAuthError(null); setAuthInfo(null); }}
                  className="text-slate-400 hover:text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </p>
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                Al continuar aceptas nuestros{' '}
                <button type="button" onClick={() => setLegalDoc("terms")} className="text-blue-400 hover:underline font-semibold cursor-pointer">
                  Términos de Servicio
                </button>{' '}
                y nuestra{' '}
                <button type="button" onClick={() => setLegalDoc("privacy")} className="text-blue-400 hover:underline font-semibold cursor-pointer">
                  Política de Privacidad
                </button>.
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre de la Empresa / Marca</label>
                <input
                  type="text"
                  required
                  placeholder="Mi Negocio"
                  value={regOrg}
                  onChange={(e) => setRegOrg(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre de la Sucursal</label>
                <input
                  type="text"
                  required
                  placeholder="Sucursal Principal"
                  value={regBranch}
                  onChange={(e) => setRegBranch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre del Administrador</label>
                <input
                  type="text"
                  required
                  placeholder="Tu Nombre"
                  value={regUser}
                  onChange={(e) => setRegUser(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="admin@negocio.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Negocio</label>
                <select
                  value={regType}
                  onChange={(e) => setRegType(e.target.value as BusinessType)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {Object.values(BusinessType).map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                Crear Cuenta Gratuita
              </button>
              <p className="text-xs text-slate-500 text-center">
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegistering(false); setAuthError(null); }}
                  className="text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Iniciar Sesión
                </button>
              </p>
            </form>
          )}
        </div>
        )}
      </div>
    );
  }

// Render Subscription paywall if expired
  if (isSubscriptionExpired()) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden" id="billing-paywall">
        {/* Ambient background blur */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl translate-x-12 translate-y-12"></div>

        <div className="w-full max-w-2xl bg-[#121214] border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10 space-y-8">
          <div className="text-center space-y-3">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-xl shadow-amber-500/5">
              <Lock className="h-7 w-7" />
            </span>
            <h2 className="text-3xl font-black text-white tracking-wider font-display">ACCESO SUSPENDIDO</h2>
            <p className="text-sm text-slate-400 font-medium">Suscripción Mensual Requerida para continuar utilizando Nimbo ERP</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-b border-slate-800/80 py-8">
            {/* Payment Instructions */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest font-mono">Pasos para la Activación</h3>
              
              <div className="space-y-3 text-xs text-slate-300">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-white font-bold">
                    <span className="h-5 w-5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                    <span>Realiza la Transferencia</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Transfiere el pago mensual de <strong className="text-white font-bold">{getTotalSubscriptionPrice().toLocaleString()}.00 CUP</strong> a uno de los siguientes destinos:
                  </p>
                  <div className="space-y-1 pt-1 text-[11px]">
                    <div className="flex justify-between border-b border-slate-800/50 pb-1">
                      <span className="text-slate-400">Transfermóvil (Móvil):</span>
                      <strong className="text-blue-300 font-mono">{transfermovilPhone}</strong>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Enzona (Usuario):</span>
                      <strong className="text-blue-300 font-mono">{enzonaUser}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="flex items-center space-x-2 text-white font-bold">
                    <span className="h-5 w-5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">2</span>
                    <span>Conserva el ID</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Copia el número/ID de transacción (TxID) del SMS de confirmación del <span className="text-white">9225</span> o de la notificación de Enzona.
                  </p>                </div>
              </div>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest font-mono">Formulario de Activación</h3>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plataforma de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentPlatform("transfermovil")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      paymentPlatform === "transfermovil"
                        ? "bg-blue-600/10 border-blue-500 text-blue-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    Transfermóvil
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentPlatform("enzona")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      paymentPlatform === "enzona"
                        ? "bg-blue-600/10 border-blue-500 text-blue-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    Enzona
                  </button>
                </div>
              </div>

              {paymentPlatform === "transfermovil" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número de Teléfono del Pago</label>
                  <input
                    type="text"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    placeholder="ej. +53 5xxxxxxx"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-white rounded-xl py-2 px-3 text-xs outline-none transition-all"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID de Transacción / Referencia</label>
                <input
                  type="text"
                  value={paymentTxId}
                  onChange={(e) => setPaymentTxId(e.target.value)}
                  placeholder="ej. 837482"
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-white rounded-xl py-2 px-3 text-xs outline-none transition-all font-mono"
                />
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-400 font-mono">
                Monto Requerido: <span className="text-emerald-400 font-bold">{getTotalSubscriptionPrice().toLocaleString()}.00 CUP</span>
              </div>

              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-xs transition-all shadow-lg shadow-blue-600/15 flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPayment ? "Procesando..." : "Activar Mi Cuenta"}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </button>
            </form>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 pt-2 gap-4">
            <div className="flex items-center space-x-2">
              <span className="font-bold">Soporte Técnico:</span>
              <span className="text-slate-400 font-mono">{transfermovilPhone}</span>
              <span>•</span>
              <span className="text-slate-400 font-mono">soporte@nimboerp.cu</span>
            </div>

            <button
              onClick={handleLogout}
              className="text-blue-400 hover:text-blue-300 font-bold cursor-pointer transition-all uppercase tracking-wider text-[10px]"
            >
              Cerrar Sesión / Salir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0A0A0B] relative text-slate-100">
      {/* Toast notifications */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-xl flex items-center space-x-3 text-sm animate-bounce border ${
            toastType === "success"
              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/90 border-rose-500/30 text-rose-300"
          }`}
          id="system-toast"
        >
          {toastType === "success" ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 text-rose-400" />}
          <span className="font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Collapsible Sidebar */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={setCurrentModule}
        businessType={branch.businessType}
        userRole={user?.role}
        mobileOpen={sidebarMobileOpen}
        onCloseMobile={() => setSidebarMobileOpen(false)}
      />

      {profileModalOpen && (
        <ProfileModal
          user={user}
          onClose={() => setProfileModalOpen(false)}
          onUserUpdated={handleUserUpdated}
          triggerToast={triggerToast}
        />
      )}

      {legalDoc && (
        <LegalModal doc={legalDoc} businessName={publicPricing?.businessName} onClose={() => setLegalDoc(null)} />
      )}

      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingDone}
          onSkip={handleOnboardingDone}
        />
      )}

      {supportModalOpen && (
        <SupportModal
          user={user}
          org={org}
          transfermovilPhone={transfermovilPhone}
          triggerToast={triggerToast}
          onClose={() => setSupportModalOpen(false)}
        />
      )}

      {/* Workspace Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Dynamic header with network status and branch indicator */}
        <Header user={user} branch={branch} onLogout={handleLogout} onRefreshData={loadAllData} onOpenProfile={() => setProfileModalOpen(true)} onToggleSidebar={() => setSidebarMobileOpen(true)} onOpenSupport={() => setSupportModalOpen(true)} />

        {/* Scrollable Workspace content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0A0A0B]" id="main-workspace">
          {currentModule === "dashboard" && (
            <DynamicDashboard
              businessType={branch.businessType}
              stats={getDashboardStats()}
              chartData={getSalesChartData()}
              monthlyChartData={getMonthlyChartData()}
              topProducts={getTopProductsData()}
              onNavigateTo={setCurrentModule}
              subscription={{
                status: org?.subscriptionStatus,
                expiresAt: org?.subscriptionExpiresAt,
                daysLeft: getSubscriptionDaysLeft()
              }}
            />
          )}

          {currentModule === "suscripcion" && (
            <div className="space-y-6 max-w-4xl mx-auto" id="suscripcion-module">
              {/* Header section with background gradient */}
              <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-2xl"></div>
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl font-black text-white tracking-wider font-display">{org?.name}</span>
                    <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono uppercase">
                      Activo
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Tu plan Nimbo ERP está activo. Gracias por formar parte de nuestra comunidad de negocios en Cuba.
                  </p>
                  <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono text-slate-300">
                    <div>
                      Días restantes: <strong className="text-white font-bold">{getSubscriptionDaysLeft()} días</strong>
                    </div>
                    <div className="text-slate-500">•</div>
                    <div>
                      Vence el: <strong className="text-white font-bold">{org?.subscriptionExpiresAt ? new Date(org.subscriptionExpiresAt).toLocaleDateString("es-CU", { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}</strong>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 relative z-10 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center min-w-[160px]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Costo Mensual</p>
                  <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{getTotalSubscriptionPrice().toLocaleString()} CUP</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {SUBSCRIPTION_BASE_PRICE.toLocaleString()} CUP base
                    {branches.length > 1 ? (
                      <> + {branches.length - 1} suc. × {SUBSCRIPTION_PER_BRANCH_PRICE.toLocaleString()} CUP</>
                    ) : (
                      <> (1 sucursal)</>
                    )}
                  </p>
                </div>
              </div>

              {/* Grid with instructions and extension form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Instructions card */}
                <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-white tracking-tight">Instrucciones para Extender o Renovar</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Puedes renovar tu suscripción de manera anticipada en cualquier momento. Los 30 días adicionales se sumarán a tu fecha de vencimiento actual de forma automática.
                  </p>

                  <div className="space-y-3 text-xs">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center space-x-2 text-white font-bold">
                        <span className="h-4 w-4 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-[10px] font-mono">1</span>
                        <span>Envía el Pago por Canales Oficiales</span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Transfiere <strong className="text-white font-bold">{getTotalSubscriptionPrice().toLocaleString()}.00 CUP</strong> usando las pasarelas cubanas:
                      </p>
                      <div className="space-y-1 pt-1 text-[11px] font-mono">
                        <div className="flex justify-between border-b border-slate-900 pb-1">
                          <span className="text-slate-500">Transfermóvil (Móvil):</span>
                          <strong className="text-blue-400">{transfermovilPhone}</strong>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-slate-500">Enzona (Usuario):</span>
                          <strong className="text-blue-400">{enzonaUser}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-1">
                      <div className="flex items-center space-x-2 text-white font-bold">
                        <span className="h-4 w-4 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-[10px] font-mono">2</span>
                        <span>Reporta la Transacción</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        Ingresa el ID de Transacción (TxID) del SMS del <strong className="text-white">9225</strong> o de tu historial de Enzona en el formulario de la derecha.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form card */}
                <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-white tracking-tight">Reportar Pago Realizado</h3>
                  
                  <form onSubmit={handleRegisterPayment} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pasarela de Pago</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentPlatform("transfermovil")}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            paymentPlatform === "transfermovil"
                              ? "bg-blue-600/10 border-blue-500 text-blue-400"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          Transfermóvil
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentPlatform("enzona")}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            paymentPlatform === "enzona"
                              ? "bg-blue-600/10 border-blue-500 text-blue-400"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          Enzona
                        </button>
                      </div>
                    </div>

                    {paymentPlatform === "transfermovil" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número de Teléfono del Pago</label>
                        <input
                          type="text"
                          value={paymentPhone}
                          onChange={(e) => setPaymentPhone(e.target.value)}
                          placeholder="ej. +53 5xxxxxxx"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-white rounded-xl py-2 px-3 text-xs outline-none transition-all font-medium"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID de Transacción / Referencia</label>
                      <input
                        type="text"
                        value={paymentTxId}
                        onChange={(e) => setPaymentTxId(e.target.value)}
                        placeholder="ej. 837482"
                        required
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-white rounded-xl py-2 px-3 text-xs outline-none transition-all font-mono font-medium"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingPayment}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-xs transition-all shadow-lg shadow-blue-600/15 flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingPayment ? "Procesando..." : "Reportar Pago y Ampliar"}
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Payment History Table */}
              <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 space-y-4" id="subscription-payments-table">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Historial de Pagos</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Listado histórico de todas las transacciones reportadas para esta cuenta.</p>
                  </div>
                  <button 
                    onClick={() => fetchSubscriptionPayments()}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-xs flex items-center space-x-1 cursor-pointer"
                    title="Actualizar historial"
                  >
                    <svg className={`h-4 w-4 ${isLoadingPayments ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.75" />
                    </svg>
                    <span>Actualizar</span>
                  </button>
                </div>

                {isLoadingPayments ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-400 font-medium">Cargando transacciones...</p>
                  </div>
                ) : subscriptionPayments.length === 0 ? (
                  <div className="border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs space-y-1">
                    <p className="font-bold text-slate-400">Sin transacciones registradas</p>
                    <p className="text-[11px]">No se han reportado pagos de suscripción en esta cuenta todavía.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950/40 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3.5 px-4 font-semibold">ID de Transacción</th>
                          <th className="py-3.5 px-4 font-semibold">Fecha de Reporte</th>
                          <th className="py-3.5 px-4 font-semibold">Pasarela / Método</th>
                          <th className="py-3.5 px-4 font-semibold">Teléfono Origen</th>
                          <th className="py-3.5 px-4 font-semibold text-right">Monto</th>
                          <th className="py-3.5 px-4 font-semibold text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                        {subscriptionPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-900/20 transition-colors">
                            <td className="py-3.5 px-4 font-mono text-white text-[11px]">{p.transactionId}</td>
                            <td className="py-3.5 px-4">
                              {new Date(p.date).toLocaleDateString("es-CU", {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="capitalize">{p.platform === "transfermovil" ? "Transfermóvil" : "Enzona"}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400">
                              {p.phone || "—"}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-white font-mono">
                              {p.amount.toLocaleString("es-CU", { minimumFractionDigits: 2 })} {p.currency}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider uppercase ${
                                p.status === "verified"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : p.status === "pending"
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                              }`}>
                                {p.status === "verified" ? "Verificado" : p.status === "pending" ? "Pendiente" : "Fallido"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bottom Support Callout */}
              <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">¿Necesitas ayuda con tu suscripción?</h4>
                  <p className="text-[11px] text-slate-400">Contáctanos directamente por WhatsApp o correo para soporte rápido en Cuba.</p>
                </div>
                <div className="flex gap-4 text-xs font-mono">
                  <span className="text-slate-300">WhatsApp: <strong className="text-white">+53 51234567</strong></span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-300">Correo: <strong className="text-white font-sans">soporte@nimboerp.cu</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* POINT OF SALE MODULE */}
          {currentModule === "pos" && (
            <div className="space-y-6" id="pos-module">
              {!cashSession ? (
                <div className="bg-[#121214] border border-slate-800 rounded-3xl p-12 max-w-md mx-auto text-center shadow-md space-y-4">
                  <div className="h-12 w-12 bg-slate-800 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight font-display">Caja Cerrada</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Para iniciar a facturar tus ventas en CUP/USD, debes abrir una sesión de caja con un saldo inicial en efectivo.
                    </p>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const val = (e.currentTarget.elements.namedItem("initialCash") as HTMLInputElement).value;
                      startCashSession(Number(val) || 0);
                    }}
                    className="space-y-3"
                  >
                    <input
                      name="initialCash"
                      type="number"
                      placeholder="Fondo de caja inicial (CUP)"
                      required
                      className="w-full bg-slate-800 border border-slate-700 text-sm rounded-xl py-2.5 px-4 font-semibold text-center text-slate-100 focus:outline-blue-500"
                    />
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-xs transition-colors cursor-pointer"
                    >
                      Abrir Turno de Caja
                    </button>
                  </form>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Products Listing */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-[#121214] border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="Buscar producto por SKU, nombre..."
                          className="w-full bg-slate-800 text-slate-200 pl-9 pr-4 py-2 text-xs rounded-xl focus:outline-blue-500 border-none"
                        />
                      </div>

                      {/* Cash Close trigger button */}
                      <button
                        onClick={() => {
                          const expected = statsSalesSumCUP() + cashSession.initialCash;
                          const countedStr = prompt(`Cierre de sesión de Caja.\nFondo Inicial: $${cashSession.initialCash} CUP\nVentas del turno (CUP): $${statsSalesSumCUP()} CUP\nEfectivo Esperado Total: $${expected} CUP\n\nIngresa el Efectivo Contado (CUP):`, String(expected));
                          if (countedStr !== null) {
                            closeCashSession(Number(countedStr), expected);
                          }
                        }}
                        className="text-xs bg-rose-950/40 text-rose-400 hover:bg-rose-900/30 border border-rose-900/50 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer"
                      >
                        Cerrar Turno de Caja
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {products.filter((p) => !p.isService).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            if (p.variants && p.variants.length > 0) {
                              // Auto add first variant or show selection
                              handleAddPosCart(p, p.variants[0]);
                            } else {
                              handleAddPosCart(p);
                            }
                          }}
                          className="bg-[#121214] border border-slate-800 hover:border-blue-500 rounded-2xl p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
                        >
                          <div className="space-y-1">
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold font-mono">
                              {p.sku || "PROD"}
                            </span>
                            <h4 className="text-xs font-bold text-slate-200 leading-tight truncate group-hover:text-blue-400">
                              {p.name}
                            </h4>
                          </div>

                          <div className="mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-extrabold text-white font-price">${p.priceCUP} CUP</p>
                              {p.priceUSD > 0 && (
                                <p className="text-[10px] text-blue-400 font-bold font-price">${p.priceUSD} USD</p>
                              )}
                            </div>
                            <span className="text-[10px] text-blue-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                              + Añadir
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: POS Cart Checkout */}
                  <div className="lg:col-span-5 bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-white border-b border-slate-800 pb-3 flex items-center font-display">
                      <ShoppingCart className="h-4 w-4 text-blue-400 mr-2" />
                      Carrito de Facturación
                    </h3>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 divide-y divide-slate-800/60">
                      {posCart.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-12">El carrito está vacío.</p>
                      ) : (
                        posCart.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between pt-2">
                            <div>
                              <h4 className="text-xs font-semibold text-slate-200">{item.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Cantidad: {item.quantity} x ${posCurrencyChoice === Currency.USD ? item.priceUSD : item.priceCUP}
                              </p>
                            </div>
                            <div className="text-right flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-200">
                                ${posCurrencyChoice === Currency.USD ? (item.priceUSD * item.quantity).toFixed(2) : (item.priceCUP * item.quantity).toFixed(2)}
                              </span>
                              <button
                                onClick={() => {
                                  const updated = [...posCart];
                                  updated.splice(idx, 1);
                                  setPosCart(updated);
                                }}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Checkout Details form */}
                    <div className="border-t border-slate-800/60 pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Customer Lookup */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Cliente</label>
                          <select
                            value={posCustomer}
                            onChange={(e) => setPosCustomer(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer"
                          >
                            <option value="" className="bg-[#121214] text-slate-200">Consumidor Final</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id} className="bg-[#121214] text-slate-200">{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Payment choice */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Venta Moneda</label>
                          <select
                            value={posCurrencyChoice}
                            onChange={(e) => setPosCurrencyChoice(e.target.value as Currency)}
                            className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 mt-1 focus:outline-none font-bold cursor-pointer"
                          >
                            <option value={Currency.CUP} className="bg-[#121214] text-slate-200">Moneda Nacional (CUP)</option>
                            <option value={Currency.USD} className="bg-[#121214] text-slate-200">Moneda Libre Conv. (USD)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Pago de Venta</label>
                          <select
                            value={posPaymentMethod}
                            onChange={(e) => setPosPaymentMethod(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer"
                          >
                            <option value="efectivo" className="bg-[#121214] text-slate-200">Efectivo</option>
                            <option value="Transfermóvil" className="bg-[#121214] text-slate-200">Transfermóvil</option>
                            <option value="Enzona" className="bg-[#121214] text-slate-200">Enzona</option>
                            <option value="credito" className="bg-[#121214] text-slate-200">Cuenta Corriente (Crédito)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Descuento (CUP)</label>
                          <input
                            type="number"
                            value={posDiscount}
                            onChange={(e) => setPosDiscount(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2 mt-1 font-semibold focus:outline-blue-500"
                          />
                        </div>
                      </div>

                      {/* Display Total summary */}
                      <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 space-y-1.5 mt-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Subtotal</span>
                          <span>
                            {posCurrencyChoice === Currency.USD ? `$${posCart.reduce((sum, item) => sum + item.priceUSD * item.quantity, 0).toFixed(2)} USD` : `$${posCart.reduce((sum, item) => sum + item.priceCUP * item.quantity, 0).toLocaleString()} CUP`}
                          </span>
                        </div>
                        {posDiscount > 0 && (
                          <div className="flex items-center justify-between text-xs text-rose-400 font-semibold">
                            <span>Descuento</span>
                            <span>-${posDiscount} CUP</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-sm font-black text-white">
                          <span>Gran Total Unificado</span>
                          <span className="text-blue-400 font-price">
                            {posCurrencyChoice === Currency.USD
                              ? `$${Math.max(0, posCart.reduce((sum, item) => sum + item.priceUSD * item.quantity, 0) - (posDiscount / exchangeRate)).toFixed(2)} USD`
                              : `$${Math.max(0, posCart.reduce((sum, item) => sum + item.priceCUP * item.quantity, 0) - posDiscount).toLocaleString()} CUP`}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (posPaymentMethod === "Transfermóvil") {
                            setPosQRModalOpen(true);
                          } else {
                            handleCheckout();
                          }
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl py-3.5 text-xs transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center cursor-pointer"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Completar y Cobrar Venta
                      </button>

                      {/* Transfermovil QR Payment Modal */}
                      <TransfermovilQRModal
                        isOpen={posQRModalOpen}
                        onClose={() => setPosQRModalOpen(false)}
                        onConfirmPayment={(ref) => {
                          setPosQRPendingRef(ref);
                          setPosQRModalOpen(false);
                          handleCheckout();
                        }}
                        amount={Math.max(0, posCart.reduce((sum: number, item: any) => sum + (posCurrencyChoice === Currency.USD ? item.priceUSD * item.quantity : item.priceCUP * item.quantity), 0) - Number(posDiscount || 0))}
                        currency={posCurrencyChoice}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PRODUCTS CATALOG MODULE */}
          {currentModule === "productos" && (
            <div className="space-y-6" id="products-module">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                    <Package className="h-6 w-6 text-blue-400 mr-2" />
                    Catálogo de Productos y Servicios
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Crea y edita productos terminados, servicios o materias primas asociadas a variantes.
                  </p>
                </div>

                <button
                  onClick={() => setShowProductForm(!showProductForm)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2 px-4 text-xs transition-all flex items-center cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nuevo Producto
                </button>
              </div>

              {showProductForm && (
                <form onSubmit={handleCreateProduct} className="bg-[#0F0F12] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-w-2xl transition-all duration-300">
                  <h3 className="font-bold text-white text-sm font-display">Registrar Nuevo Producto</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre</label>
                      <input
                        type="text"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        required
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Categoría</label>
                      <select
                        value={newProdCat}
                        onChange={(e) => setNewProdCat(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300 cursor-pointer"
                      >
                        <option value="" className="bg-[#0F0F12] text-slate-200">Seleccionar Categoría</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id} className="bg-[#0F0F12] text-slate-200">{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">SKU</label>
                      <input
                        type="text"
                        value={newProdSKU}
                        onChange={(e) => setNewProdSKU(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Código de Barra</label>
                      <input
                        type="text"
                        value={newProdBarcode}
                        onChange={(e) => setNewProdBarcode(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Unidad de Medida</label>
                      <input
                        type="text"
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Precio CUP</label>
                      <input
                        type="number"
                        value={newProdPriceCUP}
                        onChange={(e) => setNewProdPriceCUP(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Precio USD</label>
                      <input
                        type="number"
                        value={newProdPriceUSD}
                        onChange={(e) => setNewProdPriceUSD(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Costo CUP</label>
                      <input
                        type="number"
                        value={newProdCostCUP}
                        onChange={(e) => setNewProdCostCUP(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Costo USD</label>
                      <input
                        type="number"
                        value={newProdCostUSD}
                        onChange={(e) => setNewProdCostUSD(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowProductForm(false)}
                      className="bg-slate-800 text-slate-300 hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Guardar Producto
                    </button>
                  </div>
                </form>
              )}

              {/* Products Grid list table */}
              <div className="bg-[#121214] border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase bg-slate-900/40">
                        <th className="p-4">Producto</th>
                        <th className="p-4">SKU / Cód. Barras</th>
                        <th className="p-4">Categoría</th>
                        <th className="p-4 text-right">Precio CUP</th>
                        <th className="p-4 text-right">Precio USD</th>
                        <th className="p-4 text-right">Costo CUP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 flex items-center space-x-3">
                            <div>
                              <h4 className="font-bold text-slate-200">{p.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">Unidad: {p.unitOfMeasure}</p>
                            </div>
                          </td>
                          <td className="p-4 font-mono">
                            <span className="bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                              {p.sku || "N/A"}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-slate-400">{p.category?.name || "Sin Categoría"}</td>
                          <td className="p-4 text-right font-bold text-slate-200 font-price">${p.priceCUP.toLocaleString()}</td>
                          <td className="p-4 text-right font-bold text-blue-400 font-price">${p.priceUSD.toFixed(2)}</td>
                          <td className="p-4 text-right font-semibold text-slate-400 font-price">${p.costCUP.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* INVENTORY / STOCK MODULE */}
          {currentModule === "inventario" && (
            <div className="space-y-6" id="inventory-module">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                    <Boxes className="h-6 w-6 text-blue-400 mr-2" />
                    Módulo de Inventario y Almacenes
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Controla existencias físicas, realiza movimientos manuales (entradas/salidas) o transferencias inter-almacenes.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const doc = new jsPDF();
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(14);
                    doc.text("NIMBO ERP - REPORTE DE INVENTARIO", 14, 20);
                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(10);
                    doc.text(`Generado: ${new Date().toLocaleDateString("es-CU")}`, 14, 28);
                    let y = 38;
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(9);
                    doc.text("Producto", 14, y);
                    doc.text("Almacen", 80, y);
                    doc.text("Min", 130, y);
                    doc.text("Actual", 156, y);
                    doc.text("Valor CUP", 180, y);
                    y += 6;
                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(8);
                    stocks.forEach((s) => {
                      if (y > 275) { doc.addPage(); y = 20; }
                      const value = s.quantity * (s.product?.costCUP || 0);
                      doc.text(String(s.product?.name || "N/A").substring(0, 30), 14, y);
                      doc.text(String(s.warehouse?.name || "N/A"), 80, y);
                      doc.text(String(s.minStock), 130, y);
                      doc.text(String(s.quantity), 156, y);
                      doc.text(`$${(value || 0).toLocaleString()}`, 180, y);
                      y += 6;
                    });
                    y += 4;
                    const totalValue = stocks.reduce((sum, s) => sum + s.quantity * (s.product?.costCUP || 0), 0);
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(10);
                    doc.text(`Valor Total del Inventario: $${totalValue.toLocaleString()} CUP`, 14, y);
                    doc.save("Inventario_Nimbo.pdf");
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2 px-4 text-xs transition-all flex items-center cursor-pointer"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  Exportar PDF
                </button>
              </div>

              {/* Stock controls quick movement registers */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-8 bg-[#121214] border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Existencias por Almacén</span>
                    <span className="text-[10px] bg-rose-950/40 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded font-mono font-bold">
                      Niveles Críticos
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase bg-slate-900/40">
                          <th className="p-4">Producto</th>
                          <th className="p-4">Almacén</th>
                          <th className="p-4 text-center">Mín</th>
                          <th className="p-4 text-center">Cant. Actual</th>
                          <th className="p-4">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                        {stocks.map((s) => {
                          const isLow = s.quantity < s.minStock;
                          return (
                            <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                              <td className="p-4">
                                <span className="font-bold text-slate-200">{s.product?.name}</span>
                                {s.variant && (
                                  <span className="text-[10px] text-blue-400 font-semibold block mt-0.5">
                                    Variante: {s.variant.name}
                                  </span>
                                )}
                              </td>
                              <td className="p-4 font-semibold text-slate-400">{s.warehouse?.name}</td>
                              <td className="p-4 text-center font-bold">{s.minStock}</td>
                              <td className="p-4 text-center">
                                <span className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg ${isLow ? "bg-rose-950/40 text-rose-400 border border-rose-500/30" : "bg-emerald-950/40 text-emerald-400 border border-emerald-500/30"}`}>
                                  {s.quantity}
                                </span>
                              </td>
                              <td className="p-4">
                                {isLow ? (
                                  <span className="text-[10px] text-rose-400 font-bold bg-rose-950/40 border border-rose-500/20 px-2 py-0.5 rounded-full">Reabastecer</span>
                                ) : (
                                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">Estable</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Register stock adjustment */}
                <div className="md:col-span-4 bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-white text-sm font-display">Ajustar Inventario</h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const payload = {
                        stockId: (form.elements.namedItem("stockId") as HTMLSelectElement).value,
                        type: (form.elements.namedItem("type") as HTMLSelectElement).value,
                        quantity: Number((form.elements.namedItem("qty") as HTMLInputElement).value),
                        reason: (form.elements.namedItem("reason") as HTMLInputElement).value,
                        userId: user.id
                      };
                      const res = await fetch("/api/inventario/movimiento", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                      });
                      if (res.ok) {
                        triggerToast("Inventario actualizado correctamente", "success");
                        form.reset();
                        loadAllData();
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Seleccionar Stock</label>
                      <select name="stockId" required className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 focus:outline-none cursor-pointer">
                        {stocks.map((s) => (
                          <option key={s.id} value={s.id} className="bg-[#121214] text-slate-200">{s.product?.name} ({s.warehouse?.name})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                      <select name="type" required className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 focus:outline-none cursor-pointer">
                        <option value="entrada" className="bg-[#121214] text-slate-200">Entrada (Compra, Carga)</option>
                        <option value="salida" className="bg-[#121214] text-slate-200">Salida (Merma, Descarte)</option>
                        <option value="ajuste" className="bg-[#121214] text-slate-200">Ajuste (Conteo Físico Real)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Cantidad</label>
                      <input name="qty" type="number" required className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2.5 focus:outline-blue-500" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Razón o Motivo</label>
                      <input name="reason" type="text" placeholder="Conteo de fin de mes, rotura..." className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2.5 focus:outline-blue-500" />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-xs transition-colors cursor-pointer"
                    >
                      Aplicar Ajuste Físico
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ORDERS / DELIVERY MODULE */}
          {currentModule === "pedidos" && (
            <div className="space-y-6" id="orders-module">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                    <ClipboardList className="h-6 w-6 text-blue-400 mr-2" />
                    Pedidos y Delivery Activos
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Controla comandas de comida o despachos de mercancía con anticipo. Cambia estados en Kanban.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const client = prompt("Ingresa Nombre del Cliente:");
                    const address = prompt("Dirección de Entrega:");
                    if (client) {
                      // Create sample order
                      fetch("/api/orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          branchId: branch.id,
                          customerId: customers[0]?.id || null,
                          totalCUP: 1500,
                          totalUSD: 12.5,
                          notes: "Pedido rápido desde panel",
                          deliveryAddress: address || "La Habana",
                          advancePayment: 500
                        })
                      }).then(() => loadAllData());
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2 px-4 text-xs transition-all flex items-center cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nuevo Pedido
                </button>
              </div>

              {/* Kanban Columns */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {["pending", "preparing", "ready", "delivered"].map((status) => (
                  <div key={status} className="bg-[#121214] border border-slate-800 rounded-3xl p-4 min-h-[350px] space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                        {status === "pending" && "Pendiente"}
                        {status === "preparing" && "En Preparación"}
                        {status === "ready" && "Listo para Despacho"}
                        {status === "delivered" && "Entregado"}
                      </span>
                      <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-bold">
                        {orders.filter((o) => o.status === status).length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {orders.filter((o) => o.status === status).map((o) => (
                        <div key={o.id} className="bg-[#18181B] border border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-3">
                          <div>
                            <span className="text-[9px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-400">
                              #{o.id.substring(0, 8)}
                            </span>
                            <h4 className="text-xs font-bold text-white mt-1">{o.customer?.name || "Consumidor Final"}</h4>
                            <p className="text-[10px] text-slate-400 mt-1 leading-normal">{o.deliveryAddress || "Sin dirección"}</p>
                          </div>

                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-100 font-price">${o.totalCUP} CUP</span>
                            {status !== "delivered" && (
                              <button
                                onClick={async () => {
                                  const nextStatus =
                                    status === "pending"
                                      ? "preparing"
                                      : status === "preparing"
                                      ? "ready"
                                      : "delivered";
                                  await fetch(`/api/orders/${o.id}/status`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: nextStatus })
                                  });
                                  loadAllData();
                                }}
                                className="text-[10px] bg-blue-950/40 text-blue-400 border border-blue-500/20 px-2 py-1 rounded font-bold hover:bg-blue-900/20 transition-all cursor-pointer"
                              >
                                Avanzar Estado
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PURCHASES / SUPPLIERS MODULE */}
          {currentModule === "compras" && (
            <div className="space-y-6" id="purchases-module">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                    <ShoppingBag className="h-6 w-6 text-blue-400 mr-2" />
                    Órdenes de Compra y Proveedores
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Crea órdenes de compra de materia prima, recíbelas para actualizar stock automáticamente y programa facturas por pagar.
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowSupplierForm(!showSupplierForm)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl py-2 px-4 text-xs transition-colors cursor-pointer"
                  >
                    Nuevo Proveedor
                  </button>

                  <button
                    onClick={() => {
                      // Simple order creation trigger
                      if (suppliers.length === 0) {
                        triggerToast("Crea un proveedor primero", "error");
                        return;
                      }
                      fetch("/api/compras/orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          supplierId: suppliers[0].id,
                          warehouseId: warehouses[0]?.id,
                          notes: "Pedido de harina y azúcar de reposición",
                          items: [
                            { productId: products[0]?.id, quantity: 100, costCUP: 150 }
                          ]
                        })
                      }).then(() => loadAllData());
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2 px-4 text-xs transition-all flex items-center cursor-pointer"
                  >
                    Nueva Orden Compra
                  </button>
                </div>
              </div>

              {showSupplierForm && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (newSupplierName) {
                      await fetch("/api/compras/suppliers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: newSupplierName, contact: newSupplierContact })
                      });
                      loadAllData();
                      setShowSupplierForm(false);
                      setNewSupplierName("");
                      setNewSupplierContact("");
                      triggerToast("Proveedor registrado exitosamente", "success");
                    }
                  }}
                  className="bg-[#0F0F12] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-w-xl transition-all duration-300"
                >
                  <h3 className="font-bold text-white text-sm font-display">Registrar Nuevo Proveedor</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del Proveedor</label>
                      <input
                        type="text"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        required
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Información de Contacto</label>
                      <input
                        type="text"
                        value={newSupplierContact}
                        onChange={(e) => setNewSupplierContact(e.target.value)}
                        placeholder="Teléfono, email, dirección..."
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowSupplierForm(false)}
                      className="bg-slate-800 text-slate-300 hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Guardar Proveedor
                    </button>
                  </div>
                </form>
              )}

              {/* Purchase Orders List */}
              <div className="bg-[#121214] border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-800 bg-slate-900/40">
                  <span className="text-xs font-bold text-slate-200">Órdenes Realizadas</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase bg-slate-900/40">
                        <th className="p-4">ID Orden</th>
                        <th className="p-4">Proveedor</th>
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Notas / Concepto</th>
                        <th className="p-4 text-center">Estado</th>
                        <th className="p-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                      {purchaseOrders.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-300">#{po.id.substring(0, 8)}</td>
                          <td className="p-4 font-semibold text-slate-200">{po.supplier?.name}</td>
                          <td className="p-4 text-slate-400">{po.createdAt.substring(0, 10)}</td>
                          <td className="p-4 max-w-xs truncate">{po.notes || "Sin notas"}</td>
                          <td className="p-4 text-center">
                            {po.status === "received" ? (
                              <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-0.5 rounded-full">Recibido</span>
                            ) : (
                              <span className="text-[10px] bg-amber-950/40 text-amber-400 border border-amber-500/20 font-bold px-2.5 py-0.5 rounded-full">Borrador</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {po.status === "draft" && (
                              <button
                                onClick={async () => {
                                  await fetch(`/api/compras/orders/${po.id}/receive`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ userId: user.id })
                                  });
                                  loadAllData();
                                }}
                                className="text-[10px] bg-blue-950/40 border border-blue-500/20 text-blue-400 hover:bg-blue-900/20 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer"
                              >
                                Recibir Mercancía
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CLIENTS MODULE */}
          {currentModule === "clientes" && (
            <div className="space-y-6" id="clients-module">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                    <Users className="h-6 w-6 text-blue-400 mr-2" />
                    Fidelización y Ficha de Clientes
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Historial, saldo corriente, límites de créditos autorizados y canjes de puntos acumulados.
                  </p>
                </div>

                <button
                  onClick={() => setShowCustomerForm(!showCustomerForm)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2 px-4 text-xs transition-all flex items-center cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nuevo Cliente
                </button>
              </div>

              {showCustomerForm && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (newCustomerName) {
                      await fetch("/api/clientes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: newCustomerName,
                          email: newCustomerEmail,
                          phone: newCustomerPhone,
                          creditLimit: Number(newCustomerCreditLimit) || 0
                        })
                      });
                      loadAllData();
                      setShowCustomerForm(false);
                      setNewCustomerName("");
                      setNewCustomerEmail("");
                      setNewCustomerPhone("");
                      setNewCustomerCreditLimit("0");
                      triggerToast("Cliente registrado exitosamente", "success");
                    }
                  }}
                  className="bg-[#0F0F12] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-w-2xl transition-all duration-300"
                >
                  <h3 className="font-bold text-white text-sm font-display">Registrar Nuevo Cliente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre Completo</label>
                      <input
                        type="text"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        required
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                      <input
                        type="text"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Correo Electrónico</label>
                      <input
                        type="email"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Límite de Crédito (CUP)</label>
                      <input
                        type="number"
                        value={newCustomerCreditLimit}
                        onChange={(e) => setNewCustomerCreditLimit(e.target.value)}
                        className="w-full bg-[#0F0F12] border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none hover:border-slate-700 hover:bg-[#151518] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCustomerForm(false)}
                      className="bg-slate-800 text-slate-300 hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Guardar Cliente
                    </button>
                  </div>
                </form>
              )}

              {/* Customers Registry List */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {customers.map((c) => (
                  <div key={c.id} className="bg-[#121214] border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm font-display">{c.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{c.phone || "Sin teléfono"}</p>
                      </div>
                      <span className="h-8 w-8 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center font-bold text-blue-400 text-xs">
                        {c.loyaltyPoints} pt
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-400 font-semibold uppercase text-[9px]">Saldo Deudor</p>
                        <p className="font-bold text-rose-400 font-mono mt-0.5">${c.currentBalance} CUP</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold uppercase text-[9px]">Límite Crédito</p>
                        <p className="font-bold text-slate-300 font-mono mt-0.5">${c.creditLimit} CUP</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={async () => {
                          const pts = prompt("Ingresar Puntos de Fidelidad a sumar:", "50");
                          if (pts) {
                            await fetch(`/api/clientes/${c.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ loyaltyPoints: c.loyaltyPoints + Number(pts) })
                            });
                            loadAllData();
                          }
                        }}
                        className="w-full text-center text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl py-1.5 text-xs font-bold transition-all cursor-pointer"
                      >
                        Ajustar Puntos Manualmente
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRODUCTION / RECIPES MODULE */}
          {currentModule === "produccion" && (
            <div className="space-y-6" id="production-module">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                    <Factory className="h-6 w-6 text-blue-400 mr-2" />
                    Órdenes de Producción y Recetario
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Para panaderías o talleres. El inicio de la orden consume materias primas con merma, el fin incrementa producto terminado.
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowRecipeForm(!showRecipeForm)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl py-2 px-4 text-xs transition-colors cursor-pointer"
                  >
                    {showRecipeForm ? "Cerrar" : "Nueva Receta"}
                  </button>

                  <button
                    onClick={() => {
                      if (recipes.length === 0) {
                        triggerToast("Define una receta primero", "error");
                        return;
                      }
                      fetch("/api/produccion/orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          productId: recipes[0].productId,
                          recipeId: recipes[0].id,
                          plannedQuantity: 100,
                          warehouseId: warehouses[0]?.id,
                          notes: "Producción matutina estándar"
                        })
                      }).then(() => loadAllData());
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2 px-4 text-xs transition-all flex items-center cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Iniciar Lote Producción
                  </button>
                </div>
              </div>

              {showRecipeForm && (
                <form onSubmit={handleCreateRecipe} className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 max-w-xl">
                  <h3 className="font-bold text-white text-sm font-display">Crear Receta / Fórmula</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre Receta</label>
                      <input
                        type="text"
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        required
                        className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Producto Resultante</label>
                      <select
                        value={recipeProd}
                        onChange={(e) => setRecipeProd(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 focus:outline-none cursor-pointer"
                      >
                        <option value="" className="bg-[#121214] text-slate-200">Seleccionar Producto</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} className="bg-[#121214] text-slate-200">{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex space-x-2 justify-end">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Guardar Receta Estándar
                    </button>
                  </div>
                </form>
              )}

              {/* Production Track Grid */}
              <div className="bg-[#121214] border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-800 bg-slate-900/40">
                  <span className="text-xs font-bold text-slate-200">Monitoreo de Lotes de Producción</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase bg-slate-900/40">
                        <th className="p-4">Lote ID</th>
                        <th className="p-4">Producto a Elaborar</th>
                        <th className="p-4 text-center">Cant. Planificada</th>
                        <th className="p-4 text-center">Producido</th>
                        <th className="p-4">Estado</th>
                        <th className="p-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                      {productionOrders.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 font-mono">#{po.id.substring(0, 8)}</td>
                          <td className="p-4 font-bold text-slate-200">{po.product?.name}</td>
                          <td className="p-4 text-center font-bold">{po.plannedQuantity}</td>
                          <td className="p-4 text-center font-bold">{po.producedQuantity}</td>
                          <td className="p-4">
                            {po.status === "completed" && (
                              <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-0.5 rounded-full">Completado</span>
                            )}
                            {po.status === "in_progress" && (
                              <span className="text-[10px] bg-blue-950/40 text-blue-400 border border-blue-500/20 font-bold px-2.5 py-0.5 rounded-full animate-pulse">En Proceso</span>
                            )}
                            {po.status === "planned" && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-bold px-2.5 py-0.5 rounded-full">Planificado</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {po.status === "planned" && (
                              <button
                                onClick={async () => {
                                  await fetch(`/api/produccion/orders/${po.id}/start`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ userId: user.id })
                                  });
                                  loadAllData();
                                }}
                                className="text-[10px] bg-blue-950/40 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg font-bold hover:bg-blue-900/20 transition-colors cursor-pointer"
                              >
                                Consumir Materias e Iniciar
                              </button>
                            )}

                            {po.status === "in_progress" && (
                              <button
                                onClick={async () => {
                                  const count = prompt("Ingresa Cantidad Real Producida:", String(po.plannedQuantity));
                                  if (count) {
                                    await fetch(`/api/produccion/orders/${po.id}/complete`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ producedQuantity: Number(count), userId: user.id })
                                    });
                                    loadAllData();
                                  }
                                }}
                                className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-bold hover:bg-emerald-900/20 transition-colors cursor-pointer"
                              >
                                Terminar Producción
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FINANCES MODULE */}
          {currentModule === "finanzas" && (
            <div className="space-y-6" id="finances-module">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                    <DollarSign className="h-6 w-6 text-blue-400 mr-2" />
                    Finanzas, Libro Diario y Asientos
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Las ventas y compras auto-generan asientos contables en caja, proveedores e inventario de mercancías.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const desc = prompt("Concepto de Gasto:");
                    const amount = prompt("Monto del Gasto (CUP):");
                    if (desc && amount) {
                      fetch("/api/finanzas/transactions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          type: "expense",
                          amount: Number(amount),
                          currency: Currency.CUP,
                          description: desc,
                          category: "Gastos Generales",
                          userId: user.id
                        })
                      }).then(() => loadAllData());
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2 px-4 text-xs transition-all flex items-center cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Registrar Gasto No Operativo
                </button>
              </div>

              {/* Chart of Accounts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {accounts.map((acc) => (
                  <div key={acc.id} className="bg-[#121214] border border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 font-mono font-bold px-2 py-0.5 rounded">
                        Código {acc.code}
                      </span>
                      <h4 className="text-xs font-bold text-slate-100 font-display mt-2">{acc.name}</h4>
                      <p className="text-[9px] uppercase tracking-wider text-blue-400 font-semibold mt-0.5">{acc.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-100 font-price">${acc.balance.toLocaleString()} CUP</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HUMAN RESOURCES MODULE */}
          {currentModule === "rrhh" && (
            <div className="space-y-6" id="hr-module">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                    <Contact className="h-6 w-6 text-blue-400 mr-2" />
                    Recursos Humanos y Nómina de Pago
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Control de plantilla laboral, registro diario de asistencia y cálculo mensual automatizado de salarios.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const first = prompt("Nombre:");
                    const last = prompt("Apellidos:");
                    const sal = prompt("Salario Base (Mensual CUP):");
                    if (first) {
                      fetch("/api/rrhh/employees", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ firstName: first, lastName: last, baseSalary: Number(sal) || 12000 })
                      }).then(() => loadAllData());
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2 px-4 text-xs transition-all flex items-center cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nuevo Empleado
                </button>
              </div>

              {/* Employees List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#121214] border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Lista de Personal</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase bg-slate-900/40">
                          <th className="p-4">Empleado</th>
                          <th className="p-4">Fecha Ingreso</th>
                          <th className="p-4 text-right">Salario Base</th>
                          <th className="p-4 text-right">Asistencia Hoy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                        {employees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="p-4 font-bold text-slate-200">{emp.firstName} {emp.lastName}</td>
                            <td className="p-4 text-slate-400">{emp.hireDate}</td>
                            <td className="p-4 text-right font-bold text-blue-400">${emp.baseSalary.toLocaleString()} CUP</td>
                            <td className="p-4 text-right">
                              <button
                                onClick={async () => {
                                  const dateStr = new Date().toISOString().substring(0, 10);
                                  await fetch("/api/rrhh/attendance", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ employeeId: emp.id, date: dateStr, checkIn: "08:00", checkOut: "17:00" })
                                  });
                                  loadAllData();
                                  triggerToast("Asistencia registrada para hoy", "success");
                                }}
                                className="text-[10px] bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg font-bold hover:bg-emerald-900/20 transition-all cursor-pointer"
                              >
                                Firmar Entrada (08:00-17:00)
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payroll periods log with PDF */}
                <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-white text-sm font-display">Generar Período de Nómina</h3>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/rrhh/payroll", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          startDate: new Date().toISOString().substring(0, 10),
                          endDate: new Date().toISOString().substring(0, 10)
                        })
                      });
                      if (res.ok) {
                        triggerToast("Nómina calculada y guardada", "success");
                        loadAllData();
                      }
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-3 text-xs transition-colors cursor-pointer"
                  >
                    Calcular Nómina General de este Mes
                  </button>

                  <div className="space-y-3 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Historial Reciente</span>
                    {periods.map((p) => (
                      <div key={p.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-200">Nómina #{p.id.substring(0, 6)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Fecha: {p.startDate}</p>
                        </div>
                        <button
                          onClick={() => {
                            // Generate sample payment PDF slips
                            const doc = new jsPDF();
                            doc.setFont("Helvetica", "bold");
                            doc.text("NIMBO ERP - RECIBO DE NOMINA", 14, 20);
                            doc.setFont("Helvetica", "normal");
                            doc.text(`Periodo Contable: ${p.startDate}`, 14, 28);
                            p.details?.forEach((d: any, idx: number) => {
                              doc.text(`${idx + 1}. Empleado: ${d.employee?.firstName || ""} - Salario Neto: $${d.netPay} CUP`, 14, 38 + (idx * 8));
                            });
                            doc.save(`Recibo_Nomina_${p.id.substring(0, 6)}.pdf`);
                          }}
                          className="flex items-center text-[10px] font-bold bg-slate-850 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          Imprimir PDF
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REPORTS / ONAT MODULE */}
          {currentModule === "reportes" && (
            <ONATReport />
          )}

          {/* CONFIGURATION MODULE */}
          {currentModule === "configuracion" && (
            <div className="space-y-6" id="settings-module">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
                  <Settings className="h-6 w-6 text-blue-400 mr-2" />
                  Ajustes del Sistema y Tasa Cambiaria
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Establece la tasa histórica de USD para unificación CUP, consulta logs de auditoría física o cambia roles.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Configuration form */}
                <div className="md:col-span-4 bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-white text-sm font-display">Parámetros Cambiarios</h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const rate = (e.currentTarget.elements.namedItem("rate") as HTMLInputElement).value;
                      const res = await fetch("/api/configuracion", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ settings: { exchange_rate_usd: rate }, userId: user.id })
                      });
                      if (res.ok) {
                        triggerToast("Tasa de cambio guardada", "success");
                        loadAllData();
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tasa de cambio 1 USD en CUP</label>
                      <input
                        name="rate"
                        type="number"
                        defaultValue={exchangeRate}
                        required
                        className="w-full bg-slate-800 border border-slate-700 text-sm font-bold text-center text-white rounded-xl py-2.5 px-4 focus:outline-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-xs transition-colors cursor-pointer"
                    >
                      Actualizar Tasa Fiscal
                    </button>
                  </form>
                </div>

                {/* Audit log tracker */}
                <div className="md:col-span-8 bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
                  <h3 className="font-bold text-white text-sm font-display">Registro de Auditoría de Cambios</h3>
                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-2xl text-[10px] flex justify-between space-x-4">
                        <div className="space-y-1">
                          <span className="font-bold text-blue-400 uppercase font-mono bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {log.action}
                          </span>
                          <p className="font-medium text-slate-300 leading-normal mt-1">{log.changes || "No extra data"}</p>
                        </div>
                        <span className="font-mono text-slate-400 shrink-0 text-right">{log.createdAt.substring(11, 19)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transfermovil Settings (solo SUPER_ADMIN) */}
              {user?.role === Role.SUPER_ADMIN && (
                <TransfermovilSettings
                  cardCUP="9225 1234 5678 9012"
                  cardUSD="9205 9876 5432 1098"
                  phone="+53 52987654"
                  merchantId="482019"
                  triggerToast={triggerToast}
                  onRefreshData={loadAllData}
                  userId={user.id}
                />
              )}

              {/* User Management */}
              <UserManager
                currentUser={user}
                org={org}
                triggerToast={triggerToast}
                onRefreshData={loadAllData}
              />

              {/* Data Export */}
              <ExportData
                triggerToast={triggerToast}
                datasets={[
                  { label: "Productos", data: products },
                  { label: "Categorías", data: categories },
                  { label: "Inventario (Stock)", data: stocks },
                  { label: "Almacenes", data: warehouses },
                  { label: "Ventas", data: sales },
                  { label: "Pedidos", data: orders },
                  { label: "Clientes", data: customers },
                  { label: "Proveedores", data: suppliers },
                  { label: "Órdenes de Compra", data: purchaseOrders },
                  { label: "Facturas", data: invoices },
                  { label: "Recetas", data: recipes },
                  { label: "Órdenes de Producción", data: productionOrders },
                  { label: "Plan de Cuentas", data: accounts },
                  { label: "Asientos Contables", data: journalEntries },
                  { label: "Transacciones de Caja", data: cashTransactions },
                  { label: "Empleados", data: employees },
                  { label: "Locales / Sucursales", data: branches },
                  { label: "Auditoría", data: auditLogs },
                  { label: "Pagos de Suscripción", data: subscriptionPayments },
                ]}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );

  // Helper inside loop for totals
  function statsSalesSumCUP(): number {
    return sales
      .filter((s) => s.userId === user.id && s.status === "completed")
      .reduce((sum, s) => sum + s.grandTotalCUP, 0);
  }
}
