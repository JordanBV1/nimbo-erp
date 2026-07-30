/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  ClipboardList,
  ShoppingBag,
  Users,
  Factory,
  DollarSign,
  Contact,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CreditCard
} from "lucide-react";
import { BusinessType, MODULE_VISIBILITY, Role } from "../../types.js";

interface SidebarProps {
  currentModule: string;
  onSelectModule: (module: string) => void;
  businessType: BusinessType;
  userRole?: string;
}

export default function Sidebar({ currentModule, onSelectModule, businessType, userRole }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Get visible modules based on business type
  const allowedModules = MODULE_VISIBILITY[businessType] || MODULE_VISIBILITY[BusinessType.GENERAL];

  // Map of all modules with labels, icons, and IDs
  const allNavItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "pos", label: "Punto de Venta", icon: ShoppingCart },
    { id: "productos", label: "Catálogo / Prod", icon: Package },
    { id: "inventario", label: "Inventario / Stock", icon: Boxes },
    { id: "pedidos", label: "Pedidos / Delivery", icon: ClipboardList },
    { id: "compras", label: "Compras / Prov", icon: ShoppingBag },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "produccion", label: "Producción", icon: Factory },
    { id: "finanzas", label: "Contabilidad", icon: DollarSign },
    { id: "rrhh", label: "Recursos Humanos", icon: Contact },
    { id: "reportes", label: "Reportes / ONAT", icon: BarChart3 },
    { id: "suscripcion", label: "Mi Suscripción", icon: CreditCard },
    { id: "configuracion", label: "Configuración", icon: Settings }
  ];

  // Filter based on allowed list
  const navItems = allNavItems.filter((item) => {
    if (item.id === "dashboard") return true; // Dashboard is always visible
    if (item.id === "suscripcion") return true; // Subscription is always visible
    if (item.id === "configuracion") return userRole === Role.SUPER_ADMIN; // Only superadmin sees config
    return allowedModules.includes(item.id);
  });

  return (
    <aside
      className={`bg-[#121214] text-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out border-r border-slate-800 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
      id="app-sidebar"
    >
      {/* Header / Brand toggle */}
      <div className="flex flex-col">
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!isCollapsed && (
            <span className="text-xl font-black bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent tracking-widest flex items-center font-display">
              NIMBO <Sparkles className="h-4 w-4 ml-1.5 text-blue-400 animate-pulse" />
            </span>
          )}
          {isCollapsed && (
            <span className="text-xl font-black mx-auto text-blue-400 font-display">N</span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded bg-slate-850 border border-slate-800 hover:bg-blue-600 hover:text-white text-slate-400 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 mt-6 px-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-120px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id)}
                className={`w-full flex items-center p-3 text-sm font-medium transition-all group cursor-pointer ${
                  isActive
                    ? "bg-slate-800/50 text-blue-400 font-semibold border-l-2 border-blue-500 rounded-r-xl rounded-l-none pl-2.5"
                    : "text-slate-400 hover:bg-slate-800/20 hover:text-slate-200 rounded-xl"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-transform ${
                    isCollapsed ? "mx-auto" : "mr-3"
                  } ${isActive ? "scale-110 text-blue-400" : "group-hover:scale-105"}`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer copyright / small text */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-800/60 text-center">
          <p className="text-[10px] text-slate-500 font-mono">Nimbo ERP v1.0.0</p>
          <p className="text-[9px] text-slate-600 mt-0.5">La Habana, Cuba</p>
        </div>
      )}
    </aside>
  );
}
