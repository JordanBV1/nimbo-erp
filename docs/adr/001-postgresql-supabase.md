# ADR-001: PostgreSQL en producción y SQLite en desarrollo

## Estado

Aceptada.

## Contexto

El sistema debe funcionar en dos escenarios muy distintos:

- **Producción**: un servicio web gratuito con almacenamiento efímero, múltiples organizaciones y necesidad de persistencia fiable fuera del contenedor.
- **Desarrollo y pruebas**: un entorno que arranque sin infraestructura externa, que cree datos de demostración y que permita ejecutar tests aislados en segundos.

## Decisión

Usar **PostgreSQL (Supabase)** cuando existe `DATABASE_URL`, y **SQLite con `better-sqlite3`** en caso contrario. Ambas implementaciones se ocultan detrás de una interfaz única (`src/db/db.ts`), y `src/db/pg.ts` traduce los placeholders `?` a `$n` para compartir las mismas consultas.

## Consecuencias

**Positivas**

- El desarrollador clona el repositorio y ejecuta `npm run dev` sin configurar nada.
- Los tests usan una base temporal desechable.
- El despliegue no depende del disco del contenedor.

**Negativas**

- El SQL debe mantenerse compatible con ambos motores: sin `RETURNING`, sin tipos nativos de PostgreSQL, fechas como texto.
- Doble implementación de cada colección, con riesgo de divergencia.
- Algunas operaciones (como respaldos) tienen dos rutas de código.
