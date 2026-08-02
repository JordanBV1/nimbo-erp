/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, LifeBuoy, MessageSquare, MessageCircle, Send, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

interface SupportModalProps {
  user: any;
  org: any;
  transfermovilPhone?: string;
  triggerToast: (message: string, type?: "success" | "error" | "info") => void;
  onClose: () => void;
}

export default function SupportModal({ user, org, transfermovilPhone, triggerToast, onClose }: SupportModalProps) {
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<boolean>(false);

  const whatsappPhone = (transfermovilPhone?.replace(/[\s+]/g, "") || "5351234567");
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
    `Hola, escribo desde Nimbo ERP (${org?.name || "mi negocio"}). Necesito ayuda con: `
  )}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!subject.trim()) {
      setError("Escribe un asunto breve");
      return;
    }
    if (message.trim().length < 10) {
      setError("Describe tu consulta con al menos 10 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSent(true);
        triggerToast("Ticket enviado. Te responderemos a la brevedad", "success");
      } else {
        setError(data.error || "No pudimos enviar el ticket");
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión al servidor");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#151518] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-bold text-white font-display flex items-center">
            <LifeBuoy className="h-5 w-5 text-blue-400 mr-2" />
            Centro de Ayuda
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Ticket enviado</h3>
                <p className="text-xs text-slate-400 mt-1">Nuestro equipo responderá a su correo {user?.email} lo antes posible.</p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row justify-center gap-2.5">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>WhatsApp directo</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] text-slate-500 font-medium uppercase">o envía un ticket</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center space-x-2 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl px-3 py-2.5 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asunto *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="ej. No puedo abrir la caja registradora"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mensaje *</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Describe el problema o la duda. Incluye el nombre del local si aplica."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-medium resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-xs transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Enviar ticket de soporte</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}