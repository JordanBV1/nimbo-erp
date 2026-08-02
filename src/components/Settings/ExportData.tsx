/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";

export interface ExportDataset {
  label: string;
  data: any[];
}

interface ExportDataProps {
  datasets: ExportDataset[];
  triggerToast: (message: string, type?: "success" | "error" | "info") => void;
}

function toCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : []))));
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = keys.map((k) => escape(k)).join(",");
  const lines = rows.map((r) => keys.map((k) => escape((r as any)[k])).join(","));
  return [header, ...lines].join("\r\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export default function ExportData({ datasets, triggerToast }: ExportDataProps) {
  const handleExport = (ds: ExportDataset, format: "csv" | "json") => {
    try {
      if (!ds.data || ds.data.length === 0) {
        triggerToast(`No hay datos para exportar en '${ds.label}'`, "error");
        return;
      }
      const slug = ds.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
      if (format === "csv") {
        download(`${slug}-${stamp()}.csv`, toCSV(ds.data), "text/csv;charset=utf-8");
      } else {
        download(`${slug}-${stamp()}.json`, JSON.stringify(ds.data, null, 2), "application/json");
      }
      triggerToast(`Exportado '${ds.label}' en ${format.toUpperCase()}`, "success");
    } catch (e) {
      console.error(e);
      triggerToast(`Error al exportar '${ds.label}'`, "error");
    }
  };

  return (
    <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4" id="export-data-section">
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h3 className="font-bold text-white text-sm font-display flex items-center">
            <Download className="h-5 w-5 text-blue-400 mr-2" />
            Exportar Datos
          </h3>
          <p className="text-xs text-slate-400">
            Descarga tus datos en CSV (hojas de cálculo) o JSON (migración/backup). El archivo se genera en tu navegador.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {datasets.map((ds) => (
          <div key={ds.label} className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-2xl px-3.5 py-2.5">
            <span className="text-xs font-semibold text-slate-300 truncate pr-2">{ds.label}</span>
            <div className="flex space-x-1.5 shrink-0">
              <button
                onClick={() => handleExport(ds, "csv")}
                className="p-1.5 rounded-lg bg-blue-950/40 border border-blue-500/20 text-blue-400 hover:bg-blue-900/40 transition-colors cursor-pointer"
                title={`Exportar ${ds.label} en CSV`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleExport(ds, "json")}
                className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-900/40 transition-colors cursor-pointer"
                title={`Exportar ${ds.label} en JSON`}
              >
                <FileJson className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
