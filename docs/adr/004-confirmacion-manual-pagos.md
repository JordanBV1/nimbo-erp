# ADR-004: Verificación manual de pagos de suscripción

## Estado

Aceptada.

## Contexto

El público objetivo son negocios cubanos que pagan por Transfermóvil o EnZona. Ninguna de las dos plataformas ofrece una API pública de webhooks o conciliación automática accesible para este proyecto. Una pasarela internacional (Stripe, PayPal) no es viable para esos usuarios.

## Decisión

El cliente **reporta** el pago (plataforma, teléfono, identificador de transacción) y un `SUPER_ADMIN` lo **confirma o rechaza** manualmente. Al confirmar, la suscripción se extiende 30 días desde el vencimiento vigente.

## Consecuencias

**Positivas**

- Funciona con los medios de pago reales del mercado objetivo.
- No requiere acuerdos comerciales ni credenciales de pasarela.
- El flujo queda auditado en `subscription_payments` y `audit_logs`.

**Negativas**

- El alta no es inmediata: depende de una persona.
- Riesgo de fraude con identificadores de transacción falsos; se mitiga con revisión del comprobante.
- No hay conciliación automática ni reembolsos automatizados.
