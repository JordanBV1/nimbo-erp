/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X, ShieldCheck, FileText } from "lucide-react";

export type LegalDoc = "terms" | "privacy";

interface LegalModalProps {
  doc: LegalDoc;
  businessName?: string;
  onClose: () => void;
}

export default function LegalModal({ doc, businessName = "Nimbo ERP", onClose }: LegalModalProps) {
  const isTerms = doc === "terms";

  const section = (title: string, body: string) => (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">{title}</h4>
      <p className="text-[11px] leading-relaxed text-slate-400">{body}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#151518] border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="font-bold text-white font-display flex items-center">
            {isTerms ? <FileText className="h-5 w-5 text-blue-400 mr-2" /> : <ShieldCheck className="h-5 w-5 text-emerald-400 mr-2" />}
            {isTerms ? "Términos y Condiciones" : "Política de Privacidad"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <p className="text-[10px] font-mono text-slate-500">{businessName} · Última actualización: {new Date().toLocaleDateString("es-CU", { year: "numeric", month: "long", day: "numeric" })}</p>

          {isTerms ? (
            <>
              {section("1. Aceptación de los términos", `Al crear una cuenta en ${businessName}, usted acepta estos Términos y Condiciones, así como nuestra Política de Privacidad. Si no está de acuerdo, no utilice el servicio.`)}
              {section("2. Servicio", `${businessName} ofrece un sistema de gestión empresarial en la nube (punto de venta, inventario, contabilidad, producción y módulos asociados) mediante suscripción mensual pagada a través de Transfermóvil o EnZona.`)}
              {section("3. Suscripción y pagos", `La suscripción es mensual e incluye un local base. Cada local adicional suma una cuota mensual extra, según los precios publicados. El acceso al sistema se suspende si la suscripción vence. Los pagos realizados no son reembolsables, salvo disposición legal.`)}
              {section("4. Registro y cuenta", `Usted es responsable de mantener la confidencialidad de sus credenciales de acceso y de toda actividad que ocurra bajo su cuenta. Debe proporcionar información veraz al registrarse.`)}
              {section("5. Uso aceptable", `No está permitido utilizar el servicio para actividades ilegales, reproducirlo, revenderlo ni intentar acceder a información de otros clientes.`)}
              {section("6. Disponibilidad", `Realizamos esfuerzos razonables para mantener el servicio disponible, pero no garantizamos disponibilidad ininterrumpida. El servicio puede requerir mantenimientos programados.`)}
              {section("7. Responsabilidad", `${businessName} no se hace responsable por daños indirectos, pérdida de datos ocasionada por acciones del cliente, ni por interrupciones ajenas a nuestro control (red eléctrica, conectividad, etc.).`)}
              {section("8. Terminación", `Podemos suspender o terminar su acceso por incumplimiento de estos términos, impago de la suscripción, o uso fraudulento del servicio.`)}
              {section("9. Modificaciones", `Podemos actualizar estos términos periódicamente. La fecha de la última actualización se muestra al inicio de este documento. El uso continuado del servicio implica la aceptación de los cambios.`)}
            </>
          ) : (
            <>
              {section("1. Datos que recopilamos", `${businessName} almacena los datos que usted ingresa en el sistema: información de su negocio, productos, ventas, clientes, proveedores y datos de su cuenta (nombre, correo electrónico y credenciales de acceso cifradas).`)}
              {section("2. Uso de los datos", `Sus datos se utilizan exclusivamente para operar el servicio: autenticación, respaldo de información, facturación de la suscripción y soporte técnico. No vendemos ni cedemos sus datos a terceros.`)}
              {section("3. Almacenamiento y respaldo", `Los datos se almacenan en servidores seguros con acceso restringido y se realizan respaldos periódicos. Usted puede exportar sus datos en cualquier momento desde la sección de Configuración (formato CSV o JSON).`)}
              {section("4. Seguridad", `Las contraseñas se almacenan cifradas (hash). Aplicamos medidas razonables de seguridad física y lógica para proteger la información, sin poder garantizar una seguridad absoluta.`)}
              {section("5. Retención", `Los datos se conservan mientras su cuenta esté activa. Al eliminar su cuenta, los datos se eliminan de los sistemas operativos conforme a los procesos técnicos disponibles.`)}
              {section("6. Sus derechos", `Usted puede solicitar acceso, corrección o eliminación de sus datos personales escribiéndonos por los canales de contacto oficiales del servicio.`)}
              {section("7. Cambios en esta política", `Notificaremos cambios relevantes actualizando esta página con una nueva fecha de última actualización.`)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
