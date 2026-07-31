/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, User as UserIcon, Mail, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Save } from "lucide-react";

interface ProfileModalProps {
  user: any;
  onClose: () => void;
  onUserUpdated: (user: any) => void;
  triggerToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function ProfileModal({ user, onClose, onUserUpdated, triggerToast }: ProfileModalProps) {
  const [name, setName] = useState<string>(user?.name || "");
  const [email, setEmail] = useState<string>(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const wantsPassword = newPassword.length > 0;
    if (!name.trim()) {
      setError("El nombre no puede estar vacío");
      return;
    }
    if (wantsPassword && newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    const changedEmail = email.trim().toLowerCase() !== (user?.email || "").toLowerCase();
    if (changedEmail && !currentPassword) {
      setError("Debes confirmar tu contraseña actual para cambiar el correo");
      return;
    }
    if (wantsPassword && !currentPassword) {
      setError("Debes confirmar tu contraseña actual para cambiar la contraseña");
      return;
    }

    setSubmitting(true);
    try {
      const body: any = { name: name.trim() };
      if (changedEmail) body.email = email.trim();
      if (currentPassword) body.currentPassword = currentPassword;
      if (wantsPassword) body.newPassword = newPassword;

      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onUserUpdated(data.user);
        setCurrentPassword("");
        setNewPassword("");
        triggerToast("Perfil actualizado correctamente", "success");
        onClose();
      } else {
        setError(data.error || "Error al actualizar el perfil");
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión al servidor");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#151518] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-bold text-white font-display flex items-center">
            <UserIcon className="h-5 w-5 text-blue-400 mr-2" />
            Mi Perfil
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl px-3 py-2.5 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Tu nombre" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Mail className="h-3 w-3 mr-1" />
              Correo electrónico
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="tucorreo@ejemplo.com" />
          </div>

          <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl px-3 py-2.5 text-[11px] text-slate-400">
            Para cambiar el correo o la contraseña debes confirmar tu <span className="text-blue-300 font-semibold">contraseña actual</span>.
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Lock className="h-3 w-3 mr-1" />
              Contraseña actual
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Lock className="h-3 w-3 mr-1" />
              Nueva contraseña <span className="text-slate-500 normal-case font-medium ml-1">(opcional)</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 font-mono">
              {user?.role || "CAJERO"} · {user?.branchId?.slice(0, 8) || ""}
            </span>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? (
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>{submitting ? "Guardando..." : "Guardar cambios"}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-1.5 text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded-xl px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Tus cambios se aplican inmediatamente</span>
          </div>
        </form>
      </div>
    </div>
  );
}
