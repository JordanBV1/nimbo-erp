<div align="center">
<h1>Nimbo ERP</h1>
<p>Sistema de gestión empresarial completo para la nube — Punto de Venta, Inventario, Contabilidad, RRHH y más, orientado a negocios cubanos.</p>
</div>

## Descripción

Nimbo ERP es una aplicación full-stack (React + Express + SQLite) para administrar un negocio completo: ventas en el punto de venta, inventario y stock, pedidos, compras a proveedores, clientes, producción, contabilidad, recursos humanos, reportes y suscripción del servicio.

Incluye **registro de clientes por suscripción mensual** (pago vía Transfermóvil/EnZona con **confirmación manual por el administrador**), precios dinámicos según cantidad de locales, onboarding guiado, centro de ayuda con tickets, exportación de datos (CSV/JSON) y recibo de pago en PDF.

## Funcionalidades

- **Dashboard** con métricas y estado de la suscripción
- **Punto de Venta (POS)** con múltiples formas de pago
- **Catálogo / Productos** con variantes, impuestos, precios CUP/USD
- **Inventario / Stock** multi-almacén, movimientos y transferencias
- **Pedidos / Delivery**
- **Compras / Proveedores** (órdenes de compra, facturas de proveedor)
- **Clientes** con cuentas por cobrar y puntos de fidelidad
- **Producción** (recetas, órdenes de producción)
- **Contabilidad** (cuentas, asientos, transacciones de caja)
- **Recursos Humanos** (empleados)
- **Reportes / ONAT**
- **Suscripción mensual** con pago por Transfermóvil/EnZona, confirmación manual por el admin y recibo PDF
- **Perfil de usuario** auto-servicio (cambio de nombre, correo y contraseña)
- **Onboarding guiado** para nuevos usuarios
- **Centro de ayuda** con soporte por WhatsApp y tickets
- **Exportación de datos** CSV/JSON desde Configuración
- **Página pública de precios** con registro directo
- **Términos y condiciones** y **política de privacidad**

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19, Tailwind CSS 4, Vite, Recharts, jsPDF, lucide-react |
| Backend | Node.js, Express 4, TypeScript |
| Base de datos | PostgreSQL en Supabase (SQLite solo para desarrollo/fallback) |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Email | Gmail API / EmailJS / SMTP (fallback: enlace de recuperación en pantalla) |
| IA | Google Gemini (via @google/genai) |
| Testing | Vitest + Supertest |
| Deploy | Render (`node dist/server.cjs`) |

## Requisitos

- Node.js 20+
- npm

## Instalación

```bash
npm install
cp .env.example .env
```

Configura `.env` (ver sección *Variables de entorno*).

## Ejecutar en desarrollo

```bash
npm run dev
```

Arranca el servidor Express con middleware de Vite integrado (TSX para TypeScript). La base de datos se crea y siembra automáticamente en `db-data/nimbo.db` la primera vez.

## Probar

```bash
npm test
```

Los tests usan Supertest sobre la app exportada (sin levantar puerto) y una base de datos temporal aislada (`db-data/nimbo-test.db`), que se elimina al terminar.

## Build y producción

```bash
npm run build   # lint (tsc) + vite build + esbuild bundle del servidor
npm start       # node dist/server.cjs
```

El servidor sirve el frontend compilado (`dist/`) en producción y crea respaldos automáticos diarios de la base de datos en `db-data/backups/`.

## Variables de entorno

Ver `.env.example`. Todas son opcionales en desarrollo salvo `JWT_SECRET` en producción (el servidor no arranca sin ella).

| Variable | Descripción | Obligatoria |
| --- | --- | --- |
| `NODE_ENV` | `development` o `production` | Sí (prod) |
| `PORT` | Puerto del servidor (default `3000`) | No |
| `JWT_SECRET` | Clave para firmar tokens JWT | Sí (prod) |
| `DATABASE_URL` | Cadena de conexión PostgreSQL (Supabase) | No (usa SQLite si falta) |
| `GEMINI_API_KEY` | API key de Google Gemini (asistente IA) | No |
| `APP_URL` | URL pública (CORS, enlaces de email, paywall) | Sí (prod) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | SMTP para emails | No (ver Email) |
| `GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Gmail API por HTTPS (gratis, funciona en Render free) | No |
| `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` | EmailJS (gratis, sin SMTP) | No |

### Email

Prioridad de transporte: `GMAIL_*` → `EMAILJS_*` → `SMTP_*`. En el plan free de Render los puertos SMTP (25/465/587) están bloqueados, por eso se recomienda Gmail API o EmailJS (HTTPS 443). Si no hay ningún transporte configurado, los correos no se envían y la app **muestra el enlace de recuperación en pantalla** para poder reenviarlo por WhatsApp.

### Configuración de negocio (en la app, módulo Configuración)

- Nombre del negocio (`business_name`)
- Precio base y precio por local de la suscripción
- Teléfono de Transfermóvil (`transfermovil_phone`)
- Correo de soporte (`support_email`)
- Datos fiscales para reportes ONAT

## Credenciales demo

La base de datos se siembra con usuarios de ejemplo (contraseña `123456`):

- `admin@nimbo.com` — Administrador General
- `admin@bakery.com` — Administrador Panadería
- `admin@ropa.com` — Administrador Tienda de Ropa
- `cajero@ropa.com` — Cajero

## Despliegue en Render

El repositorio incluye `render.yaml` (blueprint) y `Dockerfile`. Un commit a `master` dispara deploy automático:

- Build: `npm ci && npm run build`
- Start: `node dist/server.cjs`
- Variables: `NODE_ENV=production`, `APP_URL`, `JWT_SECRET` (autogenerada), `PORT=10000`, `DATABASE_URL` (Supabase), `SMTP_*`
- Base de datos: **PostgreSQL en Supabase** (el plan free de Render no tiene disco persistente; con Supabase los datos sobreviven a cada deploy)

### Confirmación de pagos

Los clientes reportan su pago de suscripción y este queda en estado **pendiente**. El administrador (`SUPER_ADMIN`) lo confirma o rechaza desde el panel "Pagos Pendientes de Confirmación" en la sección Suscripción. Solo al confirmarlo se activa/renueva la suscripción por 30 días.

## Estructura

```
server.ts                    # API Express (auth, suscripción, soporte, schedulers)
src/
  components/                # UI React (layout, landing, Settings, modales)
  db/db.ts                   # SQLite: esquema, seed y API de datos
  db/backup.ts               # Respaldo automático diario
  mailer.ts                  # Envío de emails (SMTP)
  types.ts                   # Tipos de dominio (roles, monedas, negocios)
tests/                       # Vitest + Supertest
```

## Licencia

Uso privado. Contacto: `soporte@nimboerp.cu`
