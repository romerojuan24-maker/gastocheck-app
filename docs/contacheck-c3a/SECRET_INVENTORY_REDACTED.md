# ContaCheck · C3A.2 — Inventario redactado de secretos (§1.1)

> **Sin valores.** Correlación por fingerprint SHA-256 (12 hex). Rol/proyecto obtenidos decodificando **solo el
> payload** del JWT (no la firma). Todos referencian el proyecto **producción** `omhycwfjxynkfwywzwvz`.

## Credenciales distintas (por fingerprint)
| Fingerprint | Clasificación | Rol | Proyecto (ref) | Entorno | Vigencia |
|---|---|---|---|---|---|
| `6c01bd481ddf` | **service_role** | service_role | omhycwfjxynkfwywzwvz | **producción** | **VIGENTE (== llave viva en .env.local)** |
| `af86c1292492` | anon | anon | omhycwfjxynkfwywzwvz | producción | probable vigente |
| `9e5a35fdf6bc` | anon (2º) | anon | omhycwfjxynkfwywzwvz | producción | probable vigente (posible anterior) |

## Ubicaciones (archivo · línea · fingerprint) — todas en HEAD (rama `main`) y en historial
| Archivo | Línea | Fingerprint | Riesgo |
|---|---|---|---|
| `execute-migration.js` | 13 | 6c01bd481ddf | **CRÍTICO** |
| `execute-migration.py` | (línea del token) | 6c01bd481ddf* | **CRÍTICO** |
| `temp-migrate.js` | 9 | 6c01bd481ddf | **CRÍTICO** |
| `run-migration-and-start-app.js` | 9 | 6c01bd481ddf | **CRÍTICO** |
| `scripts/add-profiles-fk.js` | 9 | 6c01bd481ddf | **CRÍTICO** |
| `scripts/fix-orphan-profile.js` | 4 | 6c01bd481ddf | **CRÍTICO** |
| `scripts/link-demo-user.js` | 6 | 6c01bd481ddf | **CRÍTICO** |
| `scripts/reset-demo-password.js` | 4 | 6c01bd481ddf | **CRÍTICO** |
| `scripts/setup-demo-data.js` | 10 | 6c01bd481ddf | **CRÍTICO** |
| `scripts/setup-demo-user.js` | 11 | 6c01bd481ddf | **CRÍTICO** |
| `scripts/verify-user.js` | 10 | 6c01bd481ddf | **CRÍTICO** |
| `test-create-company-e2e.js` | 10 | af86c1292492 | Medio (anon) |
| `test-create-company-e2e.ps1` | 6 | af86c1292492 | Medio (anon) |
| `scripts/repro-400.js` | 9 | af86c1292492 | Medio |
| `scripts/verify-fix.js` | 4 | af86c1292492 | Medio |
| `scripts/test-supabase-keys.js` | 8 | 9e5a35fdf6bc | Medio |
| `SETUP_NUEVA_PC.md` | (2 tokens) | mixto | Medio-alto (doc) |
| `docs/ADM001_E2E_PROCEDIMIENTO_MANUAL.md` | (2 tokens) | mixto | Medio-alto (doc) |
*(`execute-migration.py` detectado en un segundo barrido; token embebido `Bearer …`.)*

## Historial (git)
| Commit | Fecha | Qué introdujo |
|---|---|---|
| `a5d4bb7` | 2026-06-23 | `scripts/*.js` (service_role + anon) |
| `f103082` | 2026-06-28 | utilidades raíz (`execute-migration.*`, `temp-migrate.js`, `run-migration-and-start-app.js`) |
| `e6465b0` | 2026-07-18 | `test-create-company-e2e.{js,ps1}` (anon) |

Todos en `main`, **pusheados a `origin`** → presentes en el remoto y en cualquier clon/fork.

## Falsos positivos (excluidos)
`pnpm-lock.yaml`, `apps/*/pnpm-lock.yaml`: los `eyJ…` son hashes de integrity de pnpm (base64), **no** secretos.

## Estado del árbol tras la limpieza
Re-escaneo global (excluyendo lockfiles): **0 tokens** en el árbol rastreado (código y markdown). Los literales
se sustituyeron por lectura de variables de entorno / placeholders. **El historial sigue conteniéndolos** (ver
`GIT_HISTORY_REMEDIATION.md`).
