/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  TrendingUp,
  AlertTriangle,
  ClipboardList,
  CookingPot,
  Boxes,
  Users,
  Award,
  CircleDollarSign,
  Briefcase,
  CreditCard,
  ArrowRight
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { BusinessType } from "../../types.js";

interface DashboardProps {
  businessType: BusinessType;
  stats: {
    todaySalesCUP: number;
    todaySalesUSD: number;
    stockAlertsCount: number;
    pendingOrdersCount: number;
    activeProductionOrdersCount: number;
    frequentCustomersCount: number;
    inventoryValueCUP: number;
    totalEmployees: number;
  };
  chartData: any[];
  monthlyChartData: any[];
  topProducts: any[];
  onNavigateTo: (module: string) => void;
  subscription?: {
    status?: 'active' | 'pending' | 'expired';
    expiresAt?: string;
    daysLeft: number;
  };
}

export default function DynamicDashboard({
  businessType,
  stats,
  chartData,
  monthlyChartData,
  topProducts,
  onNavigateTo,
  subscription
}: DashboardProps) {
  // Format currency
  const formatCUP = (v: number) => `$${v.toLocaleString()} CUP`;
  const formatUSD = (v: number) => `$${v.toLocaleString()} USD`;

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* 1. Header with greeting and business contextual description */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-[#121214] text-white rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between">
        <div className="space-y-2">
          <span className="bg-blue-500/10 text-blue-400 font-mono text-xs px-3 py-1 rounded-full border border-blue-400/20 uppercase tracking-widest font-semibold">
            Modo {businessType} activo
          </span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
            Resumen de Operaciones
          </h2>
          
        </div>

        {/* Quick action grid inside hero */}
        <div className="mt-4 md:mt-0 grid grid-cols-2 gap-2 shrink-0">
          {businessType === BusinessType.BAKERY && (
            <>
              <button
                onClick={() => onNavigateTo("produccion")}
                className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 px-4 text-xs font-semibold border border-slate-700 transition-all flex items-center cursor-pointer"
              >
                <CookingPot className="h-4 w-4 mr-1.5 text-blue-400" />
                Nueva Producción
              </button>
              <button
                onClick={() => onNavigateTo("pos")}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 px-4 text-xs font-semibold transition-all flex items-center shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <TrendingUp className="h-4 w-4 mr-1.5 animate-bounce" />
                Facturar POS
              </button>
            </>
          )}

          {businessType === BusinessType.CAFETERIA && (
            <>
              <button
                onClick={() => onNavigateTo("pedidos")}
                className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 px-4 text-xs font-semibold border border-slate-700 transition-all flex items-center cursor-pointer"
              >
                <ClipboardList className="h-4 w-4 mr-1.5 text-blue-400" />
                Ver Pedidos
              </button>
              <button
                onClick={() => onNavigateTo("pos")}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 px-4 text-xs font-semibold transition-all flex items-center shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <TrendingUp className="h-4 w-4 mr-1.5 animate-bounce" />
                Facturar POS
              </button>
            </>
          )}

          {businessType !== BusinessType.BAKERY && businessType !== BusinessType.CAFETERIA && (
            <>
              <button
                onClick={() => onNavigateTo("inventario")}
                className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 px-4 text-xs font-semibold border border-slate-700 transition-all flex items-center cursor-pointer"
              >
                <Boxes className="h-4 w-4 mr-1.5 text-blue-400" />
                Almacén
              </button>
              <button
                onClick={() => onNavigateTo("pos")}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 px-4 text-xs font-semibold transition-all flex items-center shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <TrendingUp className="h-4 w-4 mr-1.5 animate-bounce" />
                Facturar POS
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subscription Status Widget */}
      {subscription && (
        <div className="bg-gradient-to-br from-[#121214] to-[#161619] border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group" id="dashboard-subscription-widget">
          {/* Decorative grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-10"></div>
          
          {/* Subtle blue accent glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-12 translate-x-12 group-hover:bg-blue-500/10 transition-all duration-700"></div>

          <div className="flex items-center space-x-4 relative z-10 w-full md:w-auto">
            <div className="h-12 w-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/5">
              <CreditCard className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-white tracking-wider font-display uppercase">Suscripción Nimbo ERP</h4>
                <span className={`px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-full border shadow-sm ${
                  subscription.daysLeft <= 3 
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                    : subscription.daysLeft <= 7 
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}>
                  {subscription.daysLeft <= 0 ? "Expirada" : "Activa"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Suscripción actual de tu negocio. Recuerda renovar con anticipación para mantener el acceso ininterrumpido.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8 relative z-10 w-full md:w-auto justify-between md:justify-end border-t border-slate-800/60 md:border-t-0 pt-4 md:pt-0">
            <div className="flex space-x-8">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block tracking-wider">Días Restantes</span>
                <span className={`text-lg font-black font-mono block ${
                  subscription.daysLeft <= 3 
                    ? "text-rose-400" 
                    : subscription.daysLeft <= 7 
                    ? "text-amber-400" 
                    : "text-emerald-400"
                }`}>
                  {subscription.daysLeft} {subscription.daysLeft === 1 ? "día" : "días"}
                </span>
              </div>
              
              <div className="space-y-1 border-l border-slate-800/80 pl-8">
                <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block tracking-wider">Vence el</span>
                <span className="text-lg font-black font-mono text-slate-200 block">
                  {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString("es-CU", { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A"}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigateTo("suscripcion")}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/15 flex items-center shrink-0 cursor-pointer w-full sm:w-auto justify-center hover:scale-[1.02] active:scale-[0.98]"
            >
              Renovación Rápida
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Key Statistics Grid (Adaptive layout according to BusinessType) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Core Sales Metric (Always Visible) */}
        <div className="bg-[#121214] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-blue-950/10 rounded-full translate-x-6 -translate-y-6 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ventas de Hoy</span>
            <div className="h-8 w-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center">
              <CircleDollarSign className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-xl font-extrabold text-white leading-none font-display">{formatCUP(stats.todaySalesCUP)}</p>
            <p className="text-sm font-semibold text-emerald-400 mt-1">{formatUSD(stats.todaySalesUSD)}</p>
          </div>
        </div>

        {/* Stock Alerts (Critical for all) */}
        <div
          onClick={() => onNavigateTo("inventario")}
          className={`border rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden group cursor-pointer transition-all ${
            stats.stockAlertsCount > 0
              ? "bg-rose-950/20 border-rose-900/40 hover:bg-rose-950/30"
              : "bg-[#121214] border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stock Crítico</span>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stats.stockAlertsCount > 0 ? "bg-rose-950/50 border border-rose-900/30" : "bg-slate-800 border border-slate-700"}`}>
              <AlertTriangle className={`h-5 w-5 ${stats.stockAlertsCount > 0 ? "text-rose-400" : "text-slate-400"}`} />
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-xl font-extrabold text-white leading-none font-display">{stats.stockAlertsCount} Alertas</p>
            <p className="text-xs text-slate-400 mt-1">
              {stats.stockAlertsCount > 0 ? "Productos por debajo del stock mínimo" : "Todos los niveles estables"}
            </p>
          </div>
        </div>

        {/* Dynamic Context Widget 1 */}
        {businessType === BusinessType.BAKERY || businessType === BusinessType.WORKSHOP ? (
          <div
            onClick={() => onNavigateTo("produccion")}
            className="bg-[#121214] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordenes de Producción</span>
              <div className="h-8 w-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center">
                <CookingPot className="h-5 w-5 text-amber-400" />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xl font-extrabold text-white leading-none font-display">{stats.activeProductionOrdersCount} Activas</p>
              <p className="text-xs text-slate-400 mt-1">Seguimiento de recetas y merma</p>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onNavigateTo("clientes")}
            className="bg-[#121214] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fidelización</span>
              <div className="h-8 w-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center">
                <Award className="h-5 w-5 text-pink-400" />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xl font-extrabold text-white leading-none font-display">{stats.frequentCustomersCount} Recurrentes</p>
              <p className="text-xs text-slate-400 mt-1">Clientes con puntos acumulados</p>
            </div>
          </div>
        )}

        {/* Dynamic Context Widget 2 */}
        {businessType === BusinessType.CAFETERIA || businessType === BusinessType.CLOTHING || businessType === BusinessType.BOOKSTORE ? (
          <div
            onClick={() => onNavigateTo("pedidos")}
            className="bg-[#121214] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pedidos por Entregar</span>
              <div className="h-8 w-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-teal-400" />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xl font-extrabold text-white leading-none font-display">{stats.pendingOrdersCount} Pedidos</p>
              <p className="text-xs text-slate-400 mt-1">Pendientes de despacho o delivery</p>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onNavigateTo("rrhh")}
            className="bg-[#121214] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Personal / Plantilla</span>
              <div className="h-8 w-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xl font-extrabold text-white leading-none font-display">{stats.totalEmployees} Empleados</p>
              <p className="text-xs text-slate-400 mt-1">Asistencia diaria registrada</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Recharts Graphics section (Sales trend and Category distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales trend over time */}
        <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white tracking-tight">Tendencia de Ingresos</h3>
              <p className="text-xs text-slate-400">Últimos días de facturación registrada en CUP</p>
            </div>
            <span className="text-xs bg-slate-800 border border-slate-700 text-blue-400 px-2 py-1 rounded font-semibold font-mono">
              Consolidado CUP
            </span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="fecha" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", borderRadius: "12px", border: "1px solid #334155", color: "#f8fafc" }}
                  labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                />
                <Line type="monotone" dataKey="monto" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly CUP vs USD comparison */}
        <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-white tracking-tight font-display">Comparativa Mensual CUP vs USD</h3>
            <p className="text-xs text-slate-400">Últimos 6 meses</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", borderRadius: "12px", border: "1px solid #334155", color: "#f8fafc" }}
                  labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
                <Bar dataKey="cup" fill="#3b82f6" name="CUP" radius={[4, 4, 0, 0]} />
                <Bar dataKey="usd" fill="#10b981" name="USD" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top products list */}
        <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-white tracking-tight font-display">Productos Más Vendidos</h3>
            <p className="text-xs text-slate-400">Consolidado por unidades vendidas</p>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12">No hay ventas registradas todavía.</p>
            ) : (
              topProducts.map((p, index) => (
                <div key={p.id || index} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200 leading-tight">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{p.sku || "Sin SKU"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">{p.units ?? 0} uds</p>
                    <p className="text-[10px] text-blue-400 font-medium font-price">{formatCUP(p.revenueCUP ?? 0)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
