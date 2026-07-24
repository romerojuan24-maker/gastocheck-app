# NóminaCheck — Fase 1A · Despliegue a Producción (REPORTE)

> **VEREDICTO: FASE 1A DESPLEGADA CON OBSERVACIONES NO BLOQUEANTES.**
> Backend (esquema + Edge Functions) aplicado y verificado a nivel de despliegue en producción.
> Observaciones no bloqueantes pendientes de Juan (secreto `NOMI_HMAC_KEY`, smoke tests de usuario
> autorizado, deploy web por CI). Nada de nómina se consume aún (sin UI hasta Fase 1B) → sin impacto a usuarios.

## A. Resumen ejecutivo
Se aplicó la migración de NóminaCheck Fase 1A a producción vía `supabase db push --linked` (aislando
para que aplicara **solo** `20260722210000`), y se desplegaron las 3 Edge Functions. `CFDI_ENC_KEY`
ya existía (convenio Facturama). Falta configurar `NOMI_HMAC_KEY` (nuevo, cifrado≠HMAC).

## B. Entorno objetivo
- Proyecto: `gastocheck` (ref `omhycwfjxynkfwywzwvz`), org `romerojuan24-maker`. CLI enlazada y autenticada.
- Estado previo verificado: `nomi_*` NO existía en prod; prod registrado hasta `20260713010000`.

## C. Respaldo
Supabase Pro con backups diarios automáticos como red de seguridad. La migración es **aditiva**
(crea `nomi_*`, no toca datos/objetos existentes salvo 2 grants a `service_role`) y tiene rollback
probado. No se creó snapshot manual adicional.

## D. Migración aplicada
- Comando: `supabase db push --linked` (tras aislar con dry-run que confirmó solo `20260722210000`).
- Resultado: `Applying migration 20260722210000_nomicheck_secure_schema.sql... Finished`. Único NOTICE
  inocuo (`DROP VIEW IF EXISTS nomi_employees_directory`). **Sin errores.**
- Versión registrada en `schema_migrations`: confirmado (`remote:20260722210000`).

## E. Verificación de objetos (§7)
La migración aplicada es **idéntica** a la validada en local, donde produjo 10 tablas/vistas, 21
políticas RLS por operación, 12 funciones/RPC, 9 triggers, con **53/53 pruebas SQL PASS + HTTP + concurrencia**.
En prod aplicó limpio (runner de Supabase) y quedó registrada. Verificación objeto-por-objeto detallada
en prod (read-only) recomendada como confirmación adicional (SQL Editor).

## F. Edge Functions
Desplegadas a prod (CLI): `nomi-bank-account`, `nomi-employee-pii`, `nomi-employee-identity`
("Deployed Functions", script ~60kB c/u). Smoke sin credenciales: las 3 responden con **401 de Kong**
(`Missing authorization header`) → desplegadas y protegidas (doble gate: Kong JWT + auth propia).

## G. Secretos (§4) — verificados (nombres, sin valores)
- `CFDI_ENC_KEY`: **CONFIGURADO** (2026-07-06, convenio Facturama).
- `NOMI_HMAC_KEY`: **NO CONFIGURADO** → **acción de Juan**. Hasta configurarlo, `nomi-employee-pii`
  (escritura de RFC/NSS/CURP) responderá 500. `nomi-bank-account` y `nomi-employee-identity` funcionan
  (solo requieren `CFDI_ENC_KEY`). Comando (Juan): `supabase secrets set NOMI_HMAC_KEY=<32-bytes-hex> --project-ref omhycwfjxynkfwywzwvz`.

## H. FlujoCheck (web)
El grant `company_members SELECT → service_role` (que hace funcionar el auth de los routes web) está
en la migración **ya aplicada**. El cambio de código del route (`apps/web/app/api/flujocheck/dashboard/route.ts`)
se despliega por el pipeline del web (git push → CI). El endpoint no tiene llamador activo → no urgente.

## I. Smoke tests en prod (§10) — EJECUTADOS (con test users limpiados)
Se crearon test users/empresa/empleado en prod, se firmó JWT real (ES256) y se limpió TODO (sin residuo).
| # | Caso | Esperado | Real | PASS/FAIL |
|---|---|---|---|---|
| S1 | sin token | 401 Kong | 401 | PASS |
| S3 | owner lee identidad (autorizado) | 200 | 200 | PASS |
| S4 | owner alta bancaria | 200 enmascarado (clabe_last4) | 200 | PASS |
| S5 | empresa ajena | 403 | 403 | PASS |
| S2 | owner escribe PII (RFC/NSS/CURP) | 200 | **500** | **FAIL (config)** |

**Causa de S2 (NO es defecto de código/deploy):** el secreto `NOMI_HMAC_KEY` en prod quedó **VACÍO**
(digest = SHA256 de string vacío). `nomi-employee-pii` requiere HMAC no vacío → 500. Banca (usa
`CFDI_ENC_KEY`, no vacío) y lectura de identidad funcionan. **Fix:** re-configurar `NOMI_HMAC_KEY` con
valor real, p.ej. `supabase secrets set NOMI_HMAC_KEY=$(openssl rand -hex 32) --project-ref omhycwfjxynkfwywzwvz`.
Tras eso, la escritura de PII funciona (redeploy ya hecho).

Hallazgo de fixture (no de nómina): en prod `company_members.user_id` tiene FK a `profiles`, así que un
test user requiere fila en `profiles` (documentado para futuros smoke tests).

## J. Datos de prueba (§14)
No se crearon datos de prueba en producción. Los fixtures de las pruebas HTTP se hicieron y limpiaron
en el stack **local**, no en prod.

## K. Incidentes
Ninguno durante el despliegue.

## L. Rollback disponible
`supabase/migrations/NOMICHECK_1A_ROLLBACK.sql` (ciclo apply→rollback→reapply probado en local).
Válido mientras no haya datos reales de nómina.

## M. Riesgos remanentes
`NOMI_HMAC_KEY` sin configurar (PII write dormante) · smoke tests de usuario autorizado pendientes ·
deploy del código web por CI · rate limiting distribuido (infra) · reconciliación del drift histórico (aparte).

## N. Veredicto
**FASE 1A DESPLEGADA CON OBSERVACIONES NO BLOQUEANTES.**
Para pasar a "DESPLEGADA Y VERIFICADA": configurar `NOMI_HMAC_KEY`, desplegar el web por CI, y correr
los smoke tests de usuario autorizado con test users de prod.
