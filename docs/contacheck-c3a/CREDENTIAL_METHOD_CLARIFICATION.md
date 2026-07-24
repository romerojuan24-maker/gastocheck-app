# ContaCheck · C3A.1 — Aclaración del método de inspección y escaneo de secretos (§1)

## 1. Naturaleza de la inspección de C3A
- La inspección de producción fue **operativamente de solo lectura**: únicamente solicitudes `GET`/`HEAD` a
  PostgREST y `supabase migration list --linked`. **No se ejecutó ninguna solicitud de modificación** (sin POST de
  escritura, sin PATCH, sin DELETE, sin RPC de escritura, sin DDL/DML).
- Se utilizó **temporalmente** una credencial `service_role`, tomada de `apps/web/.env.local` en memoria.
- **Advertencia (importante):** `service_role` **NO es técnicamente una credencial limitada a lectura** — puede
  **omitir RLS** y escribir. Su uso aquí fue **auto-restringido a lecturas**, pero no ofrece garantía técnica de
  solo-lectura. Por eso **no** se usó para los scripts de catálogo (`05/06/07`): esos requieren `pg_catalog` y,
  para no escalar a una conexión de superusuario, se **delegan** a una sesión autenticada del SQL Editor de Juan
  (ver `PENDING_SQL_RESULTS.md`).
- **No se conectó** al pooler de prod con la credencial de `postgres` (superusuario) — habría sido más potente y
  también bypass de RLS, contrario al espíritu del gate.
- **No se imprimieron, registraron ni incorporaron secretos** a documentos, scripts ni logs. Los valores de
  `service_role`/tokens nunca aparecen en esta entrega.

## 2. Escaneo de secretos (solo repositorio local; sin mostrar valores)
Método: `git ls-files`, `git check-ignore`, `git grep` de patrones (JWT `eyJ…`, `service_role`, llaves privadas,
cadenas `postgres://…:…@`). **Solo se reporta archivo + tipo + acción; nunca el valor.**

### Hallazgos
| Archivo(s) | Tipo potencial | Severidad | Acción requerida |
|---|---|---|---|
| `execute-migration.js`, `temp-migrate.js`, `run-migration-and-start-app.js`, `test-create-company-e2e.js`, `test-create-company-e2e.ps1`, `scripts/*.js` (add-profiles-fk, fix-orphan-profile, link-demo-user, repro-400, reset-demo-password, setup-demo-data, setup-demo-user, test-supabase-keys, verify-fix, verify-user) | **Token JWT `eyJ…` hardcodeado** (probable anon y/o service_role de Supabase) | **ALTA** | **Verificar y ROTAR** las llaves en Supabase; **quitar del código** (usar env); considerar `git filter-repo` para purgar del historial |
| `run-migration-and-start-app.js`, `scripts/setup-demo-user.js`, `scripts/verify-user.js` | Referencia a `service_role` **junto a token hardcodeado** | **ALTA** | Igual que arriba (posible service_role en claro) |
| `pnpm-lock.yaml`, `apps/*/pnpm-lock.yaml` | `eyJ…` = **integrity base64 de pnpm** (NO secreto) | Falso positivo | Ninguna |
| `apps/web/.../route.ts`, `apps/web/lib/api-auth.ts`, `supabase/functions/*/index.ts` | Referencia a `SUPABASE_SERVICE_ROLE_KEY` **leída de `process.env`/`Deno.env`** (no hardcodeada) | Info | Ninguna (uso correcto por env) |
| Llaves privadas (`BEGIN … PRIVATE KEY`) | — | — | **Ninguna encontrada** |
| Cadenas `postgres://…:pass@…` en archivos versionados | — | — | **Ninguna encontrada** |

### Higiene confirmada
- `.env.local` **NO está versionado** (`git check-ignore` lo confirma); `.gitignore` cubre `.env*` (excepto
  `.env.example`). Solo se versionan `*.env.example` (plantillas sin secretos).
- **Los entregables de C3A/C3A.1** (`docs/contacheck-c3a/*`, `scripts/contacheck-c3a/*`, `deploy/contacheck-c3b/*`)
  **no contienen ningún token** (escaneo específico = limpio).

## 3. Recomendación
Los tokens hardcodeados en las utilidades `.js`/`.ps1` son **deuda de seguridad pre-existente** (no introducida
por ContaCheck). Debe abrirse una tarea aparte para: (1) confirmar si son llaves productivas, (2) **rotarlas**,
(3) moverlas a variables de entorno, (4) evaluar purga del historial de Git. **No es bloqueante para C3B** (no
afecta el esquema), pero es un riesgo de seguridad real del repo.
