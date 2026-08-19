import React, { useState } from "react";
import { QrCode, CreditCard, Phone, Building, Save, ShieldCheck, CheckCircle2 } from "lucide-react";

interface TransfermovilSettingsProps {
  cardCUP: string;
  cardUSD: string;
  phone: string;
  merchantId: string;
  triggerToast: (msg: string, type?: "success" | "error" | "warning") => void;
  onRefreshData: () => void;
  userId: string;
}

export const TransfermovilSettings: React.FC<TransfermovilSettingsProps> = ({
  cardCUP,
  cardUSD,
  phone,
  merchantId,
  triggerToast,
  onRefreshData,
  userId
}) => {
  const [formCUP, setFormCUP] = useState(cardCUP || "9225 1234 5678 9012");
  const [formUSD, setFormUSD] = useState(cardUSD || "9205 9876 5432 1098");
  const [formPhone, setFormPhone] = useState(phone || "+53 52987654");
  const [formMerchantId, setFormMerchantId] = useState(merchantId || "482019");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            transfermovil_card_cup: formCUP,
            transfermovil_card_usd: formUSD,
            transfermovil_phone: formPhone,
            transfermovil_merchant_id: formMerchantId,
            transfermovil_enabled: "true"
          },
          userId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          triggerToast("Datos de cobro por Transfermóvil actualizados con éxito", "success");
          onRefreshData();
        } else {
          triggerToast(data.error || "Error al guardar la configuración de Transfermóvil", "error");
        }
      } else {
        triggerToast("Error al guardar la configuración de Transfermóvil", "error");
      }
    } catch {
      triggerToast("Error de conexión al servidor", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base tracking-tight font-display flex items-center gap-2">
              Cobro Directo Transfermóvil (QR)
              <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Activo
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configura las tarjetas bancarias y teléfono donde tus clientes transferirán vía QR.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center space-x-1.5">
              <CreditCard className="h-3.5 w-3.5 text-cyan-400" />
              <span>Número de Tarjeta (CUP)</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: 9225 1234 5678 9012"
              value={formCUP}
              onChange={(e) => setFormCUP(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-sm font-mono font-semibold text-white rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[10px] text-slate-500">
              Tarjeta BPA / BANDEC / BANMET en Moneda Nacional.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center space-x-1.5">
              <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              <span>Número de Tarjeta (USD)</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: 9205 9876 5432 1098"
              value={formUSD}
              onChange={(e) => setFormUSD(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-sm font-mono font-semibold text-white rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-slate-500">
              Tarjeta en USD (Banco Metropolitano / BANDEC / BPA).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center space-x-1.5">
              <Phone className="h-3.5 w-3.5 text-emerald-400" />
              <span>Teléfono Vinculado a Transfermóvil</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: +53 52987654"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-sm font-mono font-semibold text-white rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-500">
              Teléfono que recibe las notificaciones de transferencia SMS (2020).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center space-x-1.5">
              <Building className="h-3.5 w-3.5 text-amber-400" />
              <span>ID / Código de Comercio (Opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej: 482019"
              value={formMerchantId}
              onChange={(e) => setFormMerchantId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-sm font-mono font-semibold text-white rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-amber-500"
            />
            <p className="text-[10px] text-slate-500">
              Código asignado si tienes contrato de Pago por QR Transfermóvil.
            </p>
          </div>

        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl py-2.5 px-6 text-xs transition-all shadow-md shadow-cyan-600/20 flex items-center space-x-2 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Guardando..." : "Guardar Tarjetas Transfermóvil"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};