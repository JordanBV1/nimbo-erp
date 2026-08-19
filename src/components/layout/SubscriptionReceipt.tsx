/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { jsPDF } from "jspdf";
import { X, CheckCircle2, Download, Receipt, Building2 } from "lucide-react";

export interface PaymentReceiptData {
  orgName: string;
  businessName: string;
  amount: number;
  currency: string;
  platform: string;
  transactionId: string;
  phone: string;
  date: string;
  expiresAt: string;
  payerName: string;
  payerEmail: string;
  branchCount: number;
}

interface SubscriptionReceiptProps {
  receipt: PaymentReceiptData;
  onClose: () => void;
  triggerToast: (message: string, type?: "success" | "error" | "info") => void;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-CU", { year: "numeric", month: "long", day: "numeric" });
const fmtMoney = (n: number) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`;

export default function SubscriptionReceipt({ receipt, onClose, triggerToast }: SubscriptionReceiptProps) {
  const ref = useRef<HTMLDivElement>(null);

  const downloadPDF = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const w = doc.internal.pageSize.getWidth();

      doc.setFillColor(10, 10, 11);
      doc.rect(0, 0, w, 80, "F");
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 80, w, 3, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE PAGO", 40, 40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(receipt.businessName, 40, 60);

      let y = 120;
      const label = (k: string, v: string, color = 30) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(k, 40, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(color);
        doc.text(v, w - 40, y, { align: "right" });
        y += 22;
      };

      label("Organización", receipt.orgName);
      label("Suscriptor", receipt.payerName);
      label("Correo", receipt.payerEmail);
      label("Fecha de pago", fmtDate(receipt.date));
      label("Plataforma", receipt.platform.toUpperCase());
      label("Teléfono / Usuario", receipt.phone || "—");
      label("No. de transacción", receipt.transactionId);
      label("Locales incluidos", String(receipt.branchCount));
      label("Vence el", fmtDate(receipt.expiresAt));

      y += 10;
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(40, y, w - 80, 48, 6, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("MONTO PAGADO", 56, y + 20);
      doc.setFontSize(16);
      doc.text(fmtMoney(receipt.amount), w - 56, y + 20, { align: "right" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 210, 230);
      doc.text("Estado: VERIFICADO", 56, y + 36);
      doc.text(`ID: ${receipt.transactionId.slice(0, 12)}…`, w - 56, y + 36, { align: "right" });

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text(`Recibo generado el ${new Date().toLocaleString("es-CU")}`, w / 2, 800, { align: "center" });
      doc.text("Gracias por confiar en " + receipt.businessName, w / 2, 812, { align: "center" });

      doc.save(`recibo-suscripcion-${receipt.transactionId.slice(0, 8)}.pdf`);
      triggerToast("PDF del recibo descargado", "success");
    } catch (err) {
      console.error(err);
      triggerToast("No se pudo generar el PDF", "error");
    }
  };

  const row = (k: string, v: string) => (
    <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
      <span className="text-slate-400">{k}</span>
      <span className="font-semibold text-white text-right">{v}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#151518] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-bold text-white font-display flex items-center">
            <Receipt className="h-5 w-5 text-emerald-400 mr-2" />
            Recibo de Pago
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={ref} className="px-6 py-5">
          <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/30 rounded-2xl px-4 py-3 mb-4">
            <div className="flex items-center space-x-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-white">Pago verificado</p>
                <p className="text-[10px] text-emerald-400 font-mono">{receipt.transactionId}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-white font-mono">{fmtMoney(receipt.amount)}</p>
              <p className="text-[9px] text-slate-400 uppercase">{fmtDate(receipt.date)}</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-4 py-1">
            {row("Organización", receipt.orgName)}
            {row("Suscriptor", receipt.payerName)}
            {row("Correo", receipt.payerEmail)}
            {row("Plataforma", receipt.platform.toUpperCase())}
            {row("Teléfono / Usuario", receipt.phone || "—")}
            {row("Locales", String(receipt.branchCount))}
            {row("Suscripción vence el", fmtDate(receipt.expiresAt))}
          </div>

          <div className="flex items-center justify-center space-x-1.5 mt-4 text-[10px] text-slate-500">
            <Building2 className="h-3 w-3" />
            <span>{receipt.businessName} · Sistema de Gestión Empresarial</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            onClick={downloadPDF}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
