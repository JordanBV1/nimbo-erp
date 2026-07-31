/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, LogOut, Building2, User as UserIcon } from "lucide-react";
import { offlineQueue } from "../../utils/offlineQueue.js";

interface HeaderProps {
  user: any;
  branch: any;
  onLogout: () => void;
  onRefreshData?: () => void;
  onOpenProfile?: () => void;
}

export default function Header({ user, branch, onLogout, onRefreshData, onOpenProfile }: HeaderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      autoSync();
    };
    const handleOffline = () => setIsOnline(false);

    const updatePending = () => {
      setPendingCount(offlineQueue.getQueue().length);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-queue-changed", updatePending);

    updatePending();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-queue-changed", updatePending);
    };
  }, []);

  const autoSync = async () => {
    if (offlineQueue.getQueue().length > 0) {
      setIsSyncing(true);
      const success = await offlineQueue.syncWithServer();
      setIsSyncing(false);
      if (success && onRefreshData) {
        onRefreshData();
      }
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    const success = await offlineQueue.syncWithServer();
    setIsSyncing(false);
    if (success && onRefreshData) {
      onRefreshData();
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-[#121214] flex items-center justify-between px-6 z-10" id="app-header">
      {/* Brand / Logo & Branch Name */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/10">N</div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">
            Nimbo<span className="text-blue-500">ERP</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center">
            <span className="font-semibold text-blue-400 mr-1">{branch?.name || "Sin Sucursal"}</span>
            ({branch?.businessType || "GENERAL"})
          </p>
        </div>
      </div>

      {/* Network & Offline Queue Sync */}
      <div className="flex items-center space-x-6">
        {/* Offline sync queue indicator */}
        {pendingCount > 0 && (
          <div className="flex items-center bg-amber-950/30 border border-amber-900/40 text-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium space-x-2">
            <span>{pendingCount} Pendientes</span>
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className={`p-1 rounded bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 flex items-center justify-center transition-all ${
                isSyncing ? "animate-spin" : ""
              } disabled:opacity-50`}
              title="Sincronizar ahora"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Live Wifi Status Indicator */}
        <div className="flex items-center space-x-1.5">
          {isOnline ? (
            <span className="flex items-center text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 px-2 py-1 rounded-full font-medium">
              <Wifi className="h-3 w-3 mr-1" />
              En línea
            </span>
          ) : (
            <span className="flex items-center text-xs text-rose-400 bg-rose-950/30 border border-rose-900/30 px-2 py-1 rounded-full font-medium">
              <WifiOff className="h-3 w-3 mr-1" />
              Sin conexión
            </span>
          )}
        </div>

        {/* User profile & logout */}
        <div className="flex items-center space-x-4 border-l border-slate-800 pl-6">
          <button
            onClick={onOpenProfile}
            className="flex items-center space-x-3 hover:bg-slate-800/60 rounded-xl px-2 py-1.5 -mx-2 transition-colors cursor-pointer text-left"
            title="Editar mi perfil"
          >
            <div className="text-right">
              <p className="text-sm font-semibold text-white leading-none">
                {user?.name || "Usuario Nimbo"}
              </p>
              <p className="text-xs text-blue-400 mt-1 font-medium bg-blue-950/40 border border-blue-900/30 px-1.5 py-0.5 rounded inline-block">
                {user?.role || "CAJERO"}
              </p>
            </div>
            <div className="h-9 w-9 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-slate-300" />
            </div>
          </button>
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
