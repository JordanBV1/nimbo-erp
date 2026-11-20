# ADR-003: Monolito modular en lugar de microservicios

## Estado

Aceptada.

## Contexto

El producto cubre muchos dominios (ventas, inventario, compras, producción, contabilidad, RRHH), pero comparte un modelo de datos fuertemente interrelacionado: una venta descuenta stock, genera movimientos de caja y asientos contables. El equipo y el presupuesto son reducidos, y el destino de despliegue es un único servicio gratuito.

## Decisión

Construir un **monolito modular**: un proceso Express, un repositorio, un despliegue, pero con separación interna por módulos y una interfaz de datos por colección.

## Consecuencias

**Positivas**

- Las transacciones entre dominios son locales y atómicas.
- Un solo pipeline de build y un solo despliegue.
- Refactorizar límites es barato mientras el producto evoluciona.

**Negativas**

- `server.ts` concentra muchas rutas y crece con el producto; conviene dividirlo por routers si supera cierto tamaño.
- El escalado es vertical o por réplicas completas, no por módulo.
- Un fallo en un módulo afecta a todo el proceso.
