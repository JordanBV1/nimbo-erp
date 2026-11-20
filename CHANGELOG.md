# Changelog

Todas las fechas están en formato ISO (AAAA-MM-DD). El proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [1.0.0] — 2026-08-18

Primera versión estable, desplegable en producción.

### Seguridad

- Aislamiento multi-tenant en todos los endpoints: toda consulta filtra por la organización derivada del token.
- Corrección de fuga de datos de nóminas y asistencia entre organizaciones.
- Restricción del historial de pagos y de la configuración global a roles autorizados.
- Cierre de brechas de robustez detectadas en auditoría: condiciones de carrera, temporizadores sin limpiar y confirmaciones falsas en la UI.
- Precisión monetaria corregida en importes CUP/USD.

### Suscripciones

- Verificación manual de pagos por Transfermóvil y EnZona (`pending → verified/rejected`).
- Precio dinámico según cantidad de locales y días de prueba configurables.
- Recordatorios por correo y recibo de pago en PDF.
- Bloqueo de módulos de negocio con suscripción vencida o inactiva.

### Infraestructura

- Capa de datos dual: PostgreSQL (Supabase) con `DATABASE_URL` y SQLite como respaldo local.
- Traducción automática de SQL entre motores.
- Respaldos automáticos cada 24 horas con retención de 7 copias.
- Configuración de despliegue en Render mediante `render.yaml` y Dockerfile multi-etapa.
- Correo transaccional con tres transportes: EmailJS, Gmail API y SMTP.
- Registro estructurado con pino e identificador de petición.

### Producto

- Punto de venta con múltiples medios de pago, cierre de caja y QR de Transfermóvil.
- Inventario multi-almacén con mínimos, transferencias y trazabilidad de movimientos.
- Compras, proveedores y recepción de mercancía con actualización de stock.
- Producción basada en recetas con consumo de ingredientes y producto terminado.
- Contabilidad de doble entrada, movimientos de caja y reporte fiscales ONAT.
- RRHH con empleados, asistencia y nóminas.
- Clientes con crédito, puntos de fidelidad y campañas por correo.
- Onboarding guiado, centro de ayuda con tickets y exportación de datos CSV/JSON.
- Página pública de precios, registro directo, términos y política de privacidad.
- Cola offline para ventas cuando se interrumpe la conexión.

## [0.9.0] — 2026-08-02

- Onboarding guiado, centro de ayuda y sidebar adaptable a móvil.
- Perfil de usuario de autoservicio.
- Creación de sucursales adicionales desde la aplicación.

## [0.5.0] — 2026-07-31

- Infraestructura de operaciones y suscripción.
- Endurecimiento del aislamiento multi-tenant.
- Modelo de precios SaaS y rol SUPER_ADMIN.

## [0.1.0] — 2026-07-27

- Versión inicial: ERP full-stack con módulos de negocio, autenticación JWT y despliegue en contenedor.
