# ContaCheck · C3A.2 — Plan de rotación de credenciales (§1.3)

> **Ejecuta Juan** (owner) con autorización explícita. El asistente **no** rota llaves ni maneja sus valores.
> **Sin secretos en este documento.**

## Alcance
Rotar la **`service_role` de producción** (`omhycwfjxynkfwywzwvz`) — **obligatorio** (llave viva expuesta) — y
las claves **`anon`** (recomendado; la anon es "pública" pero conviene por higiene tras el incidente).

## Orden recomendado
1. **Preparar reemplazos** en todos los consumidores ANTES de invalidar (para evitar caída):
   - Hosting web (Vercel/…): variable `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **Supabase Edge Functions secrets** (`supabase secrets set`): las funciones usan `service_role`/env keys.
   - **CI/CD** (GitHub Actions): secrets del repo si algún workflow usa las llaves.
   - **Variables locales** de cada desarrollador: `apps/web/.env.local`, `apps/mobile/.env`.
2. **Rotar en Supabase** (Dashboard → Project Settings → API → *Reset*/rotate):
   - `service_role` (JWT secret o rotación de service key según la opción del plan).
   - `anon` (si se rota el JWT secret, ambas se regeneran).
   > Nota: en Supabase, rotar el **JWT secret** invalida `anon` **y** `service_role` a la vez; planear la
   > actualización simultánea de todos los consumidores.
3. **Actualizar todos los consumidores** con los nuevos valores (paso 1) y desplegar.
4. **Invalidar los valores anteriores** (la rotación los invalida; confirmar que ningún servicio use el viejo).
5. **Verificar**: probar login (anon) y un endpoint backend (service_role) con las nuevas llaves; revisar logs
   por 401/403 que delaten un consumidor olvidado.

## Dependencias del código que dejarían de funcionar tras rotar (a actualizar)
- `apps/web` (SSR/API routes que leen `SUPABASE_SERVICE_ROLE_KEY`), Edge Functions (`supabase/functions/*`),
  app móvil (`EXPO_PUBLIC_SUPABASE_ANON_KEY`), y las **utilidades ya env-ificadas** (leen de `process.env`/`$env:`;
  requieren la nueva llave en el entorno, ya no hardcodeada).

## Verificación post-rotación
- `git grep` de patrones de token → 0 en el árbol (ya confirmado).
- gitleaks en CI en verde.
- Ningún 401/403 anómalo en logs tras 24 h.

## Importante
- **No** pegar los nuevos valores en ningún archivo versionado, doc, script ni log.
- La rotación **no** elimina el secreto del **historial de Git** — eso lo cubre `GIT_HISTORY_REMEDIATION.md`.
  Pero **una vez rotada, la llave del historial queda invalidada** (deja de ser un riesgo activo aunque siga en
  commits viejos). Por eso: **rotar primero** (corta el riesgo), **purgar historial después** (higiene).
