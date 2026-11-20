# Manual técnico

Guía para instalar, ejecutar, probar y desplegar Nimbo ERP.

## 1. Requisitos

- Node.js 20 o superior
- npm 10 o superior
- (Producción) Una base de datos PostgreSQL, por ejemplo un proyecto gratuito de Supabase

## 2. Estructura del repositorio

```
nimbo-erp/
├── server.ts               # Servidor Express: middleware, rutas, auth
├── src/
│   ├── App.tsx             # Composición de la SPA
│   ├── components/         # Vistas por módulo
│   ├── db/
│   │   ├── db.ts           # Interfaz de datos + implementación SQLite
│   │   ├── pg-db.ts        # Implementación PostgreSQL
│   │   ├── pg.ts           # Pool, traducción de SQL y helpers
│   │   └── backup.ts       # Respaldos programados
│   ├── mailer.ts           # Correo (EmailJS, Gmail API, SMTP)
│   ├── logger.ts           # pino + pino-http
│   ├── types.ts            # Enumeraciones e interfaces del dominio
│   └── utils/offlineQueue.ts
├── tests/                  # Vitest + Supertest
├── docs/                   # Esta documentación y ADRs
├── Dockerfile
├── render.yaml
└── vite.config.ts
```

## 3. Instalación

```bash
git clone https://github.com/JordanBV1/nimbo-erp.git
cd nimbo-erp
npm ci
cp .env.example .env
```

En Windows (PowerShell) el último comando es `Copy-Item .env.example .env`.

## 4. Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `JWT_SECRET` | En producción | Secreto para firmar tokens. Generar con: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `APP_URL` | En producción | URL pública; se usa para CORS, CSP y enlaces de correo |
| `DATABASE_URL` | No | Cadena de conexión PostgreSQL. Si falta, se usa SQLite local |
| `NODE_ENV` | No | `development` (por defecto) o `production` |
| `PORT` | No | Puerto HTTP; por defecto `3000` |
| `TRIAL_DAYS` | No | Días de prueba para nuevas organizaciones; por defecto `7` |
| `GEMINI_API_KEY` | No | Habilita el asistente de IA |
| `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` | No | Correo vía EmailJS |
| `GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | No | Correo vía Gmail API |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | No | Correo vía SMTP |
| `LOG_LEVEL` | No | Nivel de pino; por defecto `info` |
| `DB_PATH`, `BACKUP_DIR` | No | Rutas alternativas para la base SQLite y sus respaldos |

Si no se configura ningún proveedor de correo, los enlaces de restablecimiento se muestran en pantalla para entornos de desarrollo.

## 5. Modos de base de datos

| Escenario | Condición | Archivo creado |
| --- | --- | --- |
| Desarrollo | Sin `DATABASE_URL` | `db-data/nimbo.db` (se crea y siembra solo) |
| Pruebas | `npm test` | `db-data/nimbo-test.db` (se elimina al terminar) |
| Producción | Con `DATABASE_URL` | Esquema en PostgreSQL; se crea si no existe |

El esquema tiene 38 tablas y se crea automáticamente con `CREATE TABLE IF NOT EXISTS`. No hay migraciones versionadas: al cambiar el esquema hay que aplicar el cambio en ambos archivos (`db.ts` y `pg-db.ts`).

### Datos de demostración (solo SQLite local)

| Correo | Contraseña | Rol |
| --- | --- | --- |
| `admin@nimbo.com` | `123456` | SUPER_ADMIN (operador de plataforma) |
| `admin@bakery.com` | `123456` | ADMIN de panadería |
| `admin@ropa.com` | `123456` | GERENTE de tienda de ropa |
| `cajero@ropa.com` | `123456` | CAJERO |

## 6. Scripts

| Comando | Efecto |
| --- | --- |
| `npm run dev` | Servidor Express con Vite en modo desarrollo sobre el puerto 3000 |
| `npm run build` | Verifica tipos (`tsc --noEmit`), compila la SPA y empaqueta el servidor en `dist/server.cjs` |
| `npm start` | Ejecuta el build de producción |
| `npm test` | Vitest + Supertest sobre una base temporal |
| `npm run lint` / `npm run typecheck` | Verificación de tipos |
| `npm run clean` | Elimina `dist/` |

## 7. Pruebas

```bash
npm test
```

- `tests/api.test.ts` cubre salud, login válido e inválido, registro incompleto, autorización sin token y listado de productos.
- `tests/setup.ts` configura el entorno aislado.
- La app se importa sin abrir puerto, lo que hace los tests rápidos y deterministas.

Para añadir un test, importa `app` desde `../server.js` y usa `request(app)`.

## 8. Despliegue en Render

1. Crea la base en Supabase y copia la cadena de conexión (usa el *connection pooler* en el puerto 6543).
2. En Render, **New → Blueprint** y selecciona el repositorio; se leerá `render.yaml`.
3. Define los secretos marcados con `sync: false`: `DATABASE_URL` y, si usas correo, las variables SMTP.
4. Render genera `JWT_SECRET` automáticamente y define `APP_URL`.
5. El primer despliegue ejecuta `npm ci && npm run build` y arranca con `node dist/server.cjs`.
6. Verifica `https://<servicio>.onrender.com/api/health`.

Notas:

- El plan gratuito suspende el servicio tras un periodo de inactividad; la primera petición puede tardar en responder.
- El disco persistente de 1 GB (`/app/db-data`) se usa para los respaldos, no para la base cuando hay `DATABASE_URL`.

## 9. Respaldos y restauración

- En producción se genera un respaldo al arrancar y cada 24 horas.
- PostgreSQL: volcado JSON con todas las tablas en `db-data/backups/nimbo-<fecha>.json`.
- SQLite: copia binaria `nimbo-<fecha>.db` mediante la API `backup()` de better-sqlite3.
- Se conservan los 7 más recientes.
- Un SUPER_ADMIN puede forzar uno con `POST /api/backup`.

Restauración en PostgreSQL: carga cada clave del JSON en su tabla en orden de dependencias (organizaciones → sucursales → usuarios → catálogo → …).

## 10. Solución de problemas

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `JWT_SECRET must be set in production` | Arranque con `NODE_ENV=production` sin secreto | Define `JWT_SECRET` |
| `APP_URL environment variable must be set in production` | Falta la URL pública | Define `APP_URL` |
| Error al cargar `better-sqlite3` | Módulo nativo no compilado | Ejecuta `npm rebuild better-sqlite3` con el Node correcto |
| CORS bloquea el frontend | `APP_URL` no coincide con el origen | Ajusta `APP_URL` |
| Correos no llegan | Sin proveedor configurado | Configura EmailJS, Gmail API o SMTP |
| 402 en todas las rutas de negocio | Suscripción vencida | Renueva o confirma el pago desde el panel SUPER_ADMIN |

## 11. Convenciones de desarrollo

- TypeScript estricto; no se compila si hay errores de tipos.
- Validación de toda entrada de escritura con Zod en el servidor.
- Toda entidad de negocio lleva `organization_id` y se filtra por `req.orgId`.
- Los mensajes de error visibles al usuario están en español.
- Registro de auditoría para acciones sensibles (`audit_logs`).
