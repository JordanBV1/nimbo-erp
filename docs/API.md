# Referencia de la API

Base URL local: `http://localhost:3000`. Todas las rutas devuelven JSON.

## Autenticación

Los endpoints protegidos esperan la cabecera:

```http
Authorization: Bearer <token>
```

También se acepta la cookie `token`. Los errores usan el formato:

```json
{ "error": "Mensaje descriptivo" }
```

| Código | Significado |
| --- | --- |
| 400 | Datos inválidos (fallo de validación Zod) |
| 401 | Token ausente, inválido o expirado |
| 402 | Suscripción inactiva o vencida |
| 403 | Rol sin permisos o recurso de otra organización |
| 404 | Recurso no encontrado |
| 429 | Límite de peticiones excedido |
| 500 | Error interno |

Niveles de acceso usados en las tablas:

- **Público**: sin token.
- **Autenticado**: JWT válido; resuelve organización.
- **Suscripción**: JWT válido y organización con suscripción activa.
- **Rol**: además, uno de los roles indicados.

## Salud

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/health` | Público | Estado del proceso y de la base de datos |

## Autenticación y perfil

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Público | Inicia sesión; devuelve token y usuario |
| POST | `/api/auth/register` | Público | Registra organización, sucursal y administrador (prueba de 7 días) |
| POST | `/api/auth/logout` | Público | Elimina la cookie de sesión |
| POST | `/api/auth/forgot-password` | Público | Envía enlace de restablecimiento |
| POST | `/api/auth/reset-password` | Público | Cambia la contraseña con token temporal |
| GET | `/api/auth/me` | Autenticado | Usuario de la sesión actual |
| GET | `/api/auth/organization` | Autenticado | Organización y sucursal actuales |
| PUT | `/api/users/me` | Autenticado | Actualiza nombre, correo o contraseña propios |

### Ejemplo: inicio de sesión

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@nimbo.com", "password": "123456" }
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_...",
    "name": "Administrador General",
    "email": "admin@nimbo.com",
    "role": "SUPER_ADMIN",
    "branchId": "br_..."
  }
}
```

## Sucursales

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/branches` | Autenticado | Sucursales de la organización |
| POST | `/api/branches` | Rol ADMIN, SUPER_ADMIN | Crea una sucursal |

## Suscripción y pagos

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/public/pricing` | Público | Precios base, precio por sucursal y días de prueba |
| GET | `/api/subscription/pricing` | Autenticado | Precio calculado para una organización |
| GET | `/api/subscription/payments` | Autenticado | Historial de pagos de la organización |
| POST | `/api/subscription/pay` | Autenticado | Reporta un pago (Transfermóvil o EnZona) |
| GET | `/api/subscription/payments/pending` | Rol SUPER_ADMIN | Pagos pendientes de todas las organizaciones |
| POST | `/api/subscription/payments/:id/confirm` | Rol SUPER_ADMIN | Confirma un pago y extiende 30 días |
| POST | `/api/subscription/payments/:id/reject` | Rol SUPER_ADMIN | Rechaza un pago reportado |

## Catálogo

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/products` | Suscripción | Lista productos con variantes |
| POST | `/api/products` | Suscripción | Crea producto (precios CUP/USD, impuesto, categoría) |
| PUT | `/api/products/:id` | Suscripción | Actualiza producto |
| GET | `/api/categories` | Suscripción | Lista categorías |
| POST | `/api/categories` | Suscripción | Crea categoría |

## Inventario

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/inventario` | Suscripción | Existencias por almacén, con mínimos y máximos |
| POST | `/api/inventario/movimiento` | Suscripción | Registra entrada, salida o ajuste |
| POST | `/api/inventario/transferencia` | Suscripción | Transfiere stock entre almacenes |

## Punto de venta

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/pos/sessions` | Suscripción | Sesiones de caja de la sucursal |
| POST | `/api/pos/sessions/start` | Suscripción | Abre caja con fondo inicial |
| POST | `/api/pos/sessions/close` | Suscripción | Cierra caja y calcula el efectivo esperado |

## Ventas

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/sales` | Suscripción | Historial de ventas |
| POST | `/api/sales` | Suscripción | Registra venta, descuenta stock y cobra |
| POST | `/api/sales/:id/refund` | Suscripción | Anula una venta y repone stock |

### Ejemplo: registrar una venta

```http
POST /api/sales
Authorization: Bearer <token>
Content-Type: application/json

{
  "branchId": "br_123",
  "items": [
    { "productId": "prd_1", "quantity": 2, "priceCUP": 1500, "discount": 0 }
  ],
  "paymentMethod": "efectivo",
  "payments": [{ "method": "efectivo", "currency": "CUP", "amount": 3000 }]
}
```

El servidor valida stock, calcula impuestos y totales, inserta la venta y sus líneas, y registra los pagos en una sola operación de dominio.

## Pedidos y delivery

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/orders` | Suscripción | Lista pedidos |
| POST | `/api/orders` | Suscripción | Crea pedido con dirección y anticipo |
| PUT | `/api/orders/:id/status` | Suscripción | Cambia estado del pedido |

## Compras y proveedores

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/compras` | Suscripción | Proveedores, órdenes y facturas |
| POST | `/api/compras/suppliers` | Suscripción | Crea proveedor |
| POST | `/api/compras/orders` | Suscripción | Crea orden de compra |
| POST | `/api/compras/orders/:id/receive` | Suscripción | Recibe mercancía e incrementa stock |
| POST | `/api/compras/invoices/:id/pay` | Suscripción | Registra pago de factura de proveedor |

## Clientes

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/clientes` | Suscripción | Lista clientes con saldo y puntos |
| POST | `/api/clientes` | Suscripción | Crea cliente |
| PUT | `/api/clientes/:id` | Suscripción | Actualiza cliente |
| POST | `/api/clientes/campana` | Suscripción | Envía campaña por correo a clientes |

## Producción

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/produccion` | Suscripción | Recetas y órdenes de producción |
| POST | `/api/produccion/recipes` | Suscripción | Crea receta con ingredientes |
| DELETE | `/api/produccion/recipes/:id` | Rol ADMIN, SUPER_ADMIN, PRODUCCION | Elimina receta |
| POST | `/api/produccion/orders` | Suscripción | Planifica orden de producción |
| POST | `/api/produccion/orders/:id/start` | Suscripción | Inicia orden y consume ingredientes |
| POST | `/api/produccion/orders/:id/complete` | Suscripción | Cierra orden e ingresa producto terminado |

## Finanzas

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/finanzas` | Suscripción | Cuentas, asientos y movimientos de caja |
| POST | `/api/finanzas/transactions` | Rol CONTABLE, ADMIN, SUPER_ADMIN | Registra movimiento de caja |

## Recursos humanos

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/rrhh` | Suscripción | Empleados, asistencias y nóminas |
| POST | `/api/rrhh/employees` | Suscripción | Crea empleado |
| POST | `/api/rrhh/attendance` | Suscripción | Registra asistencia |
| POST | `/api/rrhh/payroll` | Rol RRHH, ADMIN, SUPER_ADMIN | Genera período de nómina |

## Usuarios

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/users` | Rol ADMIN, SUPER_ADMIN | Lista usuarios de la organización |
| POST | `/api/users` | Rol ADMIN, SUPER_ADMIN | Crea usuario con rol y sucursal |
| PUT | `/api/users/:id` | Rol ADMIN, SUPER_ADMIN | Actualiza usuario |
| DELETE | `/api/users/:id` | Rol ADMIN, SUPER_ADMIN | Elimina usuario |

## Configuración y soporte

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/configuracion` | Suscripción | Ajustes de la organización |
| POST | `/api/configuracion` | Rol SUPER_ADMIN | Actualiza ajustes globales |
| POST | `/api/onboarding/dismiss` | Suscripción | Marca el onboarding como visto |
| POST | `/api/support/ticket` | Suscripción | Abre ticket de soporte |
| GET | `/api/reportes/onat` | Suscripción | Reporte fiscal ONAT del período |
| POST | `/api/backup` | Rol SUPER_ADMIN | Genera respaldo inmediato |

## Recursos estáticos

Cualquier ruta que no empiece por `/api` devuelve la SPA (`index.html`) para que el enrutamiento del cliente funcione.
