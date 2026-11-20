# ADR-002: Autenticación con JWT en lugar de sesiones en servidor

## Estado

Aceptada.

## Contexto

La aplicación se despliega en un servicio con posibilidad de reinicios y escalado, y el cliente es una SPA que ya consume una API JSON. Se necesita autenticación sin estado compartido en el servidor.

## Decisión

Emitir un **JWT firmado con HS256**, con expiración de 24 horas, que viaja en la cabecera `Authorization: Bearer` (y opcionalmente en cookie `token`). El token se guarda **en memoria del navegador**, no en `localStorage`.

Se incluyen en el payload `userId`, `email`, `role` y `branchId`; el servidor deriva la organización a partir de la sucursal en cada petición.

## Consecuencias

**Positivas**

- El servidor no mantiene sesiones: reiniciar o escalar no invalida a los usuarios.
- El rol puede autorizarse sin consultar la base de datos.
- Guardar el token en memoria reduce la superficie de XSS comparado con `localStorage`.

**Negativas**

- No existe revocación inmediata: un token robado es válido hasta su expiración.
- Recargar la página cierra la sesión (mitigado con un endpoint `/api/auth/me` y metadatos no sensibles en `sessionStorage`).
- El secreto compartido obliga a una única clave; rotarla expulsa a todos los usuarios.
