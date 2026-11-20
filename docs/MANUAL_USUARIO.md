# Manual de usuario

Guía funcional de Nimbo ERP para el personal del negocio.

## 1. Primer acceso

1. Abre la URL de la aplicación.
2. Si ya tienes cuenta, inicia sesión con tu correo y contraseña.
3. Si es la primera vez, usa **Crear cuenta**: se registra la organización, el primer local y el usuario administrador.
4. La cuenta nueva comienza con un período de prueba (7 días por defecto) y un asistente de configuración inicial.

> En una instalación local de demostración puedes entrar con `admin@nimbo.com` / `123456`.

## 2. Roles y permisos

| Rol | Alcance principal |
| --- | --- |
| **SUPER_ADMIN** | Operador de la plataforma: confirma pagos, ajustes globales, respaldos |
| **ADMIN** | Administra la organización: sucursales, usuarios, todos los módulos |
| **GERENTE** | Operación y supervisión del local |
| **CAJERO** | Punto de venta y caja |
| **BODEGA** | Inventario, transferencias y recepciones |
| **PRODUCCION** | Recetas y órdenes de producción |
| **CONTABLE** | Finanzas, asientos y reportes fiscales |
| **RRHH** | Empleados, asistencia y nóminas |

## 3. Panel principal

El dashboard muestra indicadores del período: ventas, productos más vendidos, stock bajo, cuentas por cobrar y estado de la suscripción. Los bloques se adaptan al tipo de negocio elegido al registrarse (panadería, cafetería, tienda, farmacia, etc.).

## 4. Punto de venta

1. Abre **POS** y, si es el inicio del turno, **Abrir caja** indicando el fondo inicial.
2. Busca productos por nombre o código de barras y agrégalos al carrito.
3. Ajusta cantidades, descuentos o impuestos si corresponde.
4. Elige la forma de pago: efectivo, transferencia (con QR de Transfermóvil), crédito u otra.
5. Confirma la venta. El sistema descuenta stock, registra el pago y actualiza caja.
6. Al final del turno, **Cerrar caja** para comparar el efectivo contado con el esperado.

Si se pierde la conexión, las ventas quedan en cola local y se sincronizan al volver la red.

## 5. Inventario

- **Existencias**: stock por almacén, con mínimos y máximos configurables.
- **Movimientos**: entradas, salidas y ajustes con motivo.
- **Transferencias**: traslado de mercancía entre almacenes.
- Los productos con stock por debajo del mínimo se resaltan en el dashboard.

## 6. Compras

1. Registra **proveedores** con sus datos y condiciones de pago.
2. Crea una **orden de compra** con los productos y costos.
3. Al recibir la mercancía, usa **Recibir**: el stock se incrementa automáticamente.
4. Registra el **pago de facturas** del proveedor para mantener las cuentas al día.

## 7. Clientes

- Ficha con datos de contacto, límite de crédito, saldo pendiente y puntos de fidelidad.
- Las ventas a crédito aumentan el saldo; los pagos lo reducen.
- **Campañas**: envío de correo a los clientes registrados.

## 8. Pedidos y delivery

- Crea pedidos con fecha de entrega, dirección y anticipo.
- Cambia el estado a medida que avanza: pendiente, en preparación, en camino, entregado.

## 9. Producción

1. Define **recetas** con ingredientes y cantidades (incluye merma).
2. Planifica una **orden de producción** indicando la cantidad a elaborar.
3. Al iniciar se consumen los ingredientes del inventario.
4. Al completar se ingresa el producto terminado al almacén.

## 10. Finanzas

- **Cuentas** y **asientos** contables con líneas de debe y haber.
- **Movimientos de caja** (ingresos y gastos) categorizados.
- Consulta de saldos y estado de resultados.

## 11. Recursos humanos

- Ficha de empleados con salario base y datos bancarios.
- Registro de **asistencia** (entrada y salida).
- Generación de **períodos de nómina** con salario base, horas extra, bonificaciones y deducciones.

## 12. Reportes

- **ONAT**: resumen fiscal del período con ventas, impuestos y totales.
- Exportación de datos a CSV y JSON desde Configuración.

## 13. Suscripción

1. En **Suscripción** consulta el precio según la cantidad de locales (base 5 000 CUP + 1 000 CUP por local adicional).
2. Realiza la transferencia por Transfermóvil o EnZona.
3. Reporta el pago indicando plataforma, teléfono e identificador de la transacción.
4. El administrador de la plataforma confirma el pago y la suscripción se extiende 30 días.
5. Puedes descargar el recibo en PDF.

Si la suscripción vence, los módulos de negocio se bloquean hasta la renovación.

## 14. Perfil y ayuda

- **Perfil**: cambia tu nombre, correo y contraseña.
- **Centro de ayuda**: preguntas frecuentes, tickets de soporte y contacto por WhatsApp.
- **Cerrar sesión**: usa el menú del usuario en la cabecera.

## 15. Recomendaciones de uso

- Cierra la caja al final de cada turno.
- Revisa semanalmente el stock mínimo y las cuentas por cobrar.
- No compartas usuarios: cada acción queda registrada en la auditoría.
- Usa contraseñas de al menos 8 caracteres y cámbialas periódicamente.
