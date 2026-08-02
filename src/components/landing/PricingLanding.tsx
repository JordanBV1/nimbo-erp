/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Building, CheckCircle2, Smartphone, ArrowRight, LogIn, Store } from "lucide-react";

interface PricingLandingProps {
  pricing: any;
  onLogin: () => void;
  onRegister: () => void;
}

export default function PricingLanding({ pricing, onLogin, onRegister }: PricingLandingProps) {
  const base = Number(pricing?.basePrice ?? 5000);
  const perBranch = Number(pricing?.perBranchPrice ?? 1000);
  const phone = pricing?.transfermovilPhone || "+53 51234567";

  return (
    <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6 relative z-10 items-stretch">
      {/* Pricing / value panel */}
      <div className="bg-[#121214] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="space-y-2">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Store className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight font-display">
            Gestiona tu negocio, <span className="text-blue-400">en un solo lugar</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Punto de venta, inventario, contabilidad, producción y más. Todo en la nube, accesible desde cualquier dispositivo.
          </p>
        </div>

        {/* Price card */}
        <div className="bg-slate-900/50 border border-blue-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan Básico · Suscripción mensual</p>
              <p className="text-3xl font-black text-white font-mono mt-1">
                {base.toLocaleString()} <span className="text-sm font-bold text-blue-400">{pricing?.currency || "CUP"}/mes</span>
              </p>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono uppercase">
              Activo
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300 border-t border-slate-800 pt-3">
            <span className="flex items-center">
              <Building className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              1er local incluido
            </span>
            <span className="font-mono text-slate-400">{perBranch.toLocaleString()} CUP / local extra / mes</span>
          </div>
        </div>

        <ul className="space-y-2.5 text-xs text-slate-300">
          {[
            "Punto de venta y facturación ilimitados",
            "Inventario y almacenes por sucursal",
            "Contabilidad y reportes financieros",
            "Producción y recetas (panaderías, cafeterías…)",
            "Soporte de pago por Transfermóvil y EnZona",
          ].map((f) => (
            <li key={f} className="flex items-start">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mr-2 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-3 text-[11px] text-slate-400">
          <span className="flex items-center">
            <Smartphone className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
            Contacto de pago
          </span>
          <span className="font-mono text-blue-300">{phone}</span>
        </div>
      </div>

      {/* Auth entry card */}
      <div className="bg-[#121214] border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col justify-center space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-white font-display">¿Listo para empezar?</h3>
          <p className="text-xs text-slate-400">
            Crea tu cuenta en menos de un minuto o accede si ya eres cliente.
          </p>
        </div>

        <button
          onClick={onRegister}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Store className="h-4 w-4" />
          <span>Crear mi cuenta gratis</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          onClick={onLogin}
          className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-xl py-3 text-sm transition-colors flex items-center justify-center space-x-2 cursor-pointer"
        >
          <LogIn className="h-4 w-4" />
          <span>Ya tengo cuenta · Iniciar sesión</span>
        </button>

        <p className="text-[10px] text-slate-500 text-center leading-relaxed">
          Al crear una cuenta aceptas nuestros términos de servicio y política de privacidad.
        </p>
      </div>
    </div>
  );
}
