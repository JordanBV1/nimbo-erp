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
  BarChart3,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Rocket
} from "lucide-react";

interface OnboardingModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

const steps = [
  {
    icon: Rocket,
    title: "¡Bienvenido a Nimbo ERP!",
    body: "Este breve recorrido te mostrará los módulos principales para que empieces a operar tu negocio en menos de 5 minutos.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    body: "Tu centro de control: ventas del día, inventario crítico, flujo de caja y alertas de vencimiento. Todo en tiempo real.",
  },
  {
    icon: ShoppingCart,
    title: "Punto de Venta",
    body: "Registra ventas rápidas, aplica descuentos, cambia entre CUP/USD y genera facturas al instante. Funciona incluso sin internet.",
  },
  {
    icon: Package,
    title: "Catálogo y Productos",
    body: "Crea productos con precios en CUP y USD, variantes, recetas e imágenes. Organízalos por categorías para vender más rápido.",
  },
  {
    icon: Boxes,
    title: "Inventario y Almacenes",
    body: "Controla stock por sucursal, transferencias entre almacenes, mermas y ajustes. Recibirás alertas de stock mínimo.",
  },
  {
    icon: BarChart3,
    title: "Reportes y Contabilidad",
    body: "Reportes de ventas, utilidades y contabilidad simple en CUP/USD, listos para tu contabilidad o declaraciones.",
  },
  {
    icon: CreditCard,
    title: "Suscripción",
    body: "Tu plan incluye 1 local; puedes añadir más sucursales. El pago mensual se realiza por Transfermóvil o EnZona.",
  },
];

export default function OnboardingModal({ onComplete, onSkip }: OnboardingModalProps) {
  const [step, setStep] = useState<number>(0);
  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#151518] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="relative px-8 pt-8 pb-6 text-center">
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Omitir recorrido"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-xl shadow-blue-500/5 mb-4">
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-white font-display">{current.title}</h2>
          <p className="text-xs text-slate-400 leading-relaxed mt-2">{current.body}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center space-x-1.5 mt-5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === step ? "w-6 bg-blue-400" : "w-1.5 bg-slate-700 hover:bg-slate-600"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-8 py-5 border-t border-slate-800">
          <button
            onClick={step === 0 ? onSkip : () => setStep(step - 1)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            {step === 0 ? "Omitir" : (
              <>
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Atrás</span>
              </>
            )}
          </button>

          <button
            onClick={isLast ? onComplete : () => setStep(step + 1)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <span>{isLast ? "¡Empezar a trabajar!" : "Siguiente"}</span>
            {isLast ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
