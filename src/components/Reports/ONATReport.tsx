/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Download, Table, Calculator, FileSpreadsheet, FileText, Calendar, RefreshCw } from "lucide-react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";

interface ONATLine {
  fecha: string;
  concepto: string;
  ingreso: number;
  gasto: number;
}

interface ONATReportData {
  month: number;
  year: number;
  exchangeRate: number;
  lines: ONATLine[];
}

export default function ONATReport() {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<ONATReportData | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes/onat?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error("Error loading ONAT report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [month, year]);

  // Calculations
  const totalIngreso = report?.lines.reduce((sum, l) => sum + l.ingreso, 0) || 0;
  const totalGasto = report?.lines.reduce((sum, l) => sum + l.gasto, 0) || 0;
  const utilidadNeta = totalIngreso - totalGasto;
  const impuestoEstimado = utilidadNeta > 0 ? utilidadNeta * 0.10 : 0; // standard 10% on TCP/Pyme

  // Export to Excel
  const handleExportExcel = async () => {
    if (!report) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`ONAT ${month}-${year}`);

    // Set Column Widths
    worksheet.columns = [
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Concepto / Descripción", key: "concepto", width: 40 },
      { header: "Ingreso (CUP)", key: "ingreso", width: 20 },
      { header: "Gasto (CUP)", key: "gasto", width: 20 }
    ];

    // Title Row
    worksheet.mergeCells("A1:D1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `REPORTE CONSOLIDADO DE INGRESOS Y GASTOS (ONAT) - MES ${month}/${year}`;
    titleCell.font = { name: "Arial", size: 14, bold: true };
    titleCell.alignment = { horizontal: "center" };

    // Exchange Rate Row
    worksheet.mergeCells("A2:D2");
    const subCell = worksheet.getCell("A2");
    subCell.value = `Tasa de Cambio de MLC aplicada: $${report.exchangeRate} CUP`;
    subCell.font = { name: "Arial", size: 10, italic: true };
    subCell.alignment = { horizontal: "center" };

    worksheet.addRow([]); // Blank row

    // Table Headers
    const headerRow = worksheet.addRow(["Fecha", "Concepto / Descripción", "Ingreso (CUP)", "Gasto (CUP)"]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E7FF" }
      };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "medium" },
        left: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // Add Data Lines
    report.lines.forEach((line) => {
      worksheet.addRow([line.fecha, line.concepto, line.ingreso, line.gasto]);
    });

    worksheet.addRow([]); // Blank row

    // Summary Totals
    const r1 = worksheet.addRow(["", "TOTAL GENERAL INGRESOS", totalIngreso, ""]);
    r1.font = { bold: true };
    const r2 = worksheet.addRow(["", "TOTAL GENERAL GASTOS", "", totalGasto]);
    r2.font = { bold: true };
    const r3 = worksheet.addRow(["", "UTILIDAD NETA FISCAL", utilidadNeta, ""]);
    r3.font = { bold: true, color: { argb: "FF10B981" } };
    const r4 = worksheet.addRow(["", "ESTIMADO IMPUESTO (10%)", impuestoEstimado, ""]);
    r4.font = { bold: true, color: { argb: "FFEE4444" } };

    // Trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_ONAT_${month}_${year}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (!report) return;

    const doc = new jsPDF();

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text("NIMBO ERP - REPORTE ONAT", 14, 20);

    doc.setFontSize(11);
    doc.setFont("Helvetica", "normal");
    doc.text(`Periodo Contable: Mes ${month} / Año ${year}`, 14, 28);
    doc.text(`Tasa de cambio de referencia: 1 MLC = ${report.exchangeRate} CUP`, 14, 34);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 40, 182, 35, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 40, 182, 35);

    doc.setFont("Helvetica", "bold");
    doc.text("Resumen Fiscal (CUP):", 18, 46);
    doc.setFont("Helvetica", "normal");
    doc.text(`Total Ingresos: $${totalIngreso.toLocaleString()}`, 18, 54);
    doc.text(`Total Gastos: $${totalGasto.toLocaleString()}`, 18, 62);
    doc.setFont("Helvetica", "bold");
    doc.text(`Utilidad Estimada: $${utilidadNeta.toLocaleString()}`, 18, 70);

    // Grid layout header
    let startY = 85;
    doc.setFillColor(79, 70, 229);
    doc.rect(14, startY, 182, 8, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("Fecha", 16, startY + 5);
    doc.text("Concepto", 45, startY + 5);
    doc.text("Ingreso (CUP)", 135, startY + 5);
    doc.text("Gasto (CUP)", 165, startY + 5);

    doc.setTextColor(0, 0, 0);
    doc.setFont("Helvetica", "normal");

    let currentY = startY + 8;
    report.lines.forEach((l) => {
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(l.fecha, 16, currentY + 5);
      doc.text(l.concepto.substring(0, 42), 45, currentY + 5);
      doc.text(`$${l.ingreso.toFixed(2)}`, 135, currentY + 5);
      doc.text(`$${l.gasto.toFixed(2)}`, 165, currentY + 5);
      doc.line(14, currentY + 8, 196, currentY + 8);
      currentY += 8;
    });

    doc.save(`Reporte_ONAT_${month}_${year}.pdf`);
  };

  const meses = [
    { value: 1, label: "Enero" },
    { value: 2, label: "Febrero" },
    { value: 3, label: "Marzo" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Mayo" },
    { value: 6, label: "Junio" },
    { value: 7, label: "Julio" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Septiembre" },
    { value: 10, label: "Octubre" },
    { value: 11, label: "Noviembre" },
    { value: 12, label: "Diciembre" }
  ];

  return (
    <div className="space-y-6" id="onat-report-module">
      {/* Selector and Title */}
      <div className="bg-[#121214] border border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center font-display">
            <Calculator className="h-6 w-6 text-blue-400 mr-2" />
            Consolidado Fiscal ONAT
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Calcula ingresos y gastos unificados en CUP. Los montos MLC se auto-convierten al valor histórico.
          </p>
        </div>

        {/* Form controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-slate-200">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent text-sm text-slate-200 focus:outline-none font-semibold cursor-pointer"
            >
              {meses.map((m) => (
                <option key={m.value} value={m.value} className="bg-[#121214] text-slate-200">{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-slate-200">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent text-sm text-slate-200 focus:outline-none font-semibold cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y} className="bg-[#121214] text-slate-200">{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchReport}
            disabled={loading}
            className="p-2 bg-slate-800 text-blue-400 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
            title="Recargar reporte"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-[#121214] border border-slate-800 rounded-3xl p-16 text-center shadow-sm">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400 font-semibold">Generando reporte fiscal unificado...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-[#121214] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Ingresos</p>
              <p className="text-xl font-extrabold text-white leading-none font-display">${totalIngreso.toLocaleString()} CUP</p>
            </div>

            <div className="bg-[#121214] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Gastos</p>
              <p className="text-xl font-extrabold text-white leading-none font-display">${totalGasto.toLocaleString()} CUP</p>
            </div>

            <div className="bg-[#121214] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Utilidad Neta</p>
              <p className={`text-xl font-extrabold font-display ${utilidadNeta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                ${utilidadNeta.toLocaleString()} CUP
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-5 shadow-md space-y-1">
              <p className="text-xs font-bold text-blue-100 uppercase tracking-wider">Impuesto Estimado (10%)</p>
              <p className="text-xl font-extrabold font-display">${impuestoEstimado.toLocaleString()} CUP</p>
            </div>
          </div>

          {/* Export actions and table */}
          <div className="bg-[#121214] border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 bg-slate-900/60">
              <h3 className="font-bold text-slate-200 flex items-center text-sm font-display">
                <Table className="h-4 w-4 mr-2 text-blue-400" />
                Vista Previa de Declaración de Ingresos y Gastos
              </h3>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                  Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase bg-slate-900/40">
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Concepto</th>
                    <th className="p-4 text-right">Ingreso (CUP)</th>
                    <th className="p-4 text-right">Gasto (CUP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                  {report?.lines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-500 font-medium">
                        No hay transacciones registradas para este mes contable.
                      </td>
                    </tr>
                  ) : (
                    report?.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                        <td className="p-4 font-mono font-semibold text-slate-400">{line.fecha}</td>
                        <td className="p-4 font-medium text-slate-200">{line.concepto}</td>
                        <td className="p-4 text-right font-semibold text-emerald-400 font-price">
                          {line.ingreso > 0 ? `$${line.ingreso.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-4 text-right font-semibold text-rose-400 font-price">
                          {line.gasto > 0 ? `$${line.gasto.toLocaleString()}` : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
