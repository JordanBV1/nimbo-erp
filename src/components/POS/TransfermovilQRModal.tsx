import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Copy, Check, CreditCard, Phone, Smartphone, ShieldCheck, X, ArrowRight } from "lucide-react";

interface TransfermovilQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (transactionRef: string) => void;
  amount: number;
  currency: "CUP" | "USD";
  cardCUP?: string;
  cardUSD?: string;
  phone?: string;
  merchantId?: string;
}

export const TransfermovilQRModal: React.FC<TransfermovilQRModalProps> = ({
  isOpen,
  onClose,
  onConfirmPayment,
  amount,
  currency,
  cardCUP = "9225 1234 5678 9012",
  cardUSD = "9205 9876 5432 1098",
  phone = "+53 52987654",
  merchantId = "482019"
}) => {
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const currentCard = currency === "USD" ? (cardUSD || "9205 9876 5432 1098") : (cardCUP || "9225 1234 5678 9012");
  const cleanCard = currentCard.replace(/\s+/g, "");

  const qrPayload = `ETECSA|TRANSFERMOVIL|PAYMENT|TARJETA:${cleanCard}|TELEFONO:${phone.replace(/\s+/g, "")}|MONTO:${amount.toFixed(2)}|MONEDA:${currency}|MERCHANT:${merchantId}`;

  const handleCopyCard = () => {
    navigator.clipboard.writeText(cleanCard);
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 2000);
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      onConfirmPayment(transactionRef.trim() || `TM-${Math.floor(100000 + Math.random() * 900000)}`);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#121216] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto text-slate-100">
        
        <div className="p-5 border-b border-slate-800/80 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-[#121216] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base tracking-tight font-display">Cobro Transfermóvil</h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  QR Oficial
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Escanea con la app Transfermóvil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          
          <div className="text-center p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monto Exacto a Cobrar</span>
            <p className="text-2xl font-black text-emerald-400 font-price tracking-tight">
              ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
            </p>
            <p className="text-[11px] text-slate-400">
              Transferencia directa a tarjeta <span className="font-semibold text-slate-200">{currency}</span>
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-inner border border-slate-200 space-y-3">
            <QRCodeSVG
              value={qrPayload}
              size={180}
              level="H"
              includeMargin={true}
            />
            <span className="text-[11px] font-bold text-slate-700 tracking-wide flex items-center">
              <Smartphone className="h-3.5 w-3.5 text-blue-600 mr-1.5" />
              Transfermóvil (BPA • BANDEC • BANMET)
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 bg-slate-900/60 border border-slate-800/90 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-4 w-4 text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Tarjeta ({currency})</span>
                  <span className="text-xs font-mono font-bold text-slate-200 tracking-wider">{currentCard}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyCard}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all border border-slate-700"
              >
                {copiedCard ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">¡Copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 bg-slate-900/60 border border-slate-800/90 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-blue-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Teléfono de Confirmación</span>
                  <span className="text-xs font-mono font-bold text-slate-200 tracking-wider">{phone}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all border border-slate-700"
              >
                {copiedPhone ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-800">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center justify-between">
                <span>Nro. de Operación / Folio (Transfermóvil)</span>
                <span className="text-[10px] text-slate-500 font-normal">Opcional pero recomendado</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej: TM-482910 ó 2020 SMS Folio"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl py-3 text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isVerifying}
                className="flex-[2] bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl py-3 text-xs transition-all shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2"
              >
                {isVerifying ? (
                  <span>Verificando...</span>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Confirmar Pago y Facturar</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};