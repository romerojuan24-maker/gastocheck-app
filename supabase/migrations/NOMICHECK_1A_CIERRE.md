# NóminaCheck — Fase 1A · CIERRE (Quality Gate + despliegue)

Ejecutado sobre **Supabase local** (stack completo) + Deno standalone para HTTP + `next dev` (local)
para FlujoCheck. **Nada aplicado a producción. Sin secretos de producción. No se inició Fase 1B.**

## 1. Matriz definitiva de pruebas (única)
| Grupo | Tipo | Casos | Resultado |
|---|---|---|---|
| RLS/capacidades/alcances/cripto/concurrencia SQL | SQL | 53 asserts | **53/53 PASS** |
| `nomi-bank-account` | HTTP | 10 (auth/authz/validación/masking) | PASS |
| `nomi-employee-pii` (escritura RFC/NSS/CURP) | HTTP | 4 + verificación en BD | PASS |
| `nomi-employee-identity` (lectura descifrada) | HTTP | 3 + auditoría | PASS |
| `/api/flujocheck/dashboard` | HTTP | 6 (401/400/200/403×2) | PASS |
| Aprobación / RFC / cuenta primaria | Concurrencia real (2 conexiones) | 3 | PASS |
| Rendimiento (5,000 empleados) | EXPLAIN ANALYZE | 4 ops | índices óptimos; RLS 178ms (documentado) |
| Rollback | ciclo apply→rollback→reapply | 1 | PASS |

## 2. Bugs cazados por las pruebas reales (corregidos, en la migración)
1. `service_role` sin `SELECT` en `company_members` → auth de routes web devolvía 403 a todos. **GRANT agregado.**
2. `service_role` sin `INSERT` en `audit_logs` → auditorías de Edge Functions fallaban en silencio. **GRANT agregado.**
3. `position` (reservada) sin comillas en `RETURNS TABLE` → habría fallado al aplicar. **Corregido.**
4. Trigger functions con `EXECUTE` a public → **revocado**.
5. JSON malformado → 400 genérico (antes 500 con detalle) + límite de body; `search_path = pg_catalog, public`; campos de versión de llave.

## 3. Auditoría SECURITY DEFINER (verificado en BD)
Todas con `search_path` fijo. `nomi_can/in_scope/is_self_payroll/get_employee_directory/payroll_summary/approve_payroll` = `pg_catalog, public`, EXECUTE revocado de public/anon, sólo authenticated. `nomi_blind_hash` = `pg_catalog` + `extensions.hmac` calificado, sólo service_role. Trigger functions sin EXECUTE para nadie.

## 4. Logs / PII (§9)
0 `console.log` en las 3 funciones · 0 RFC/CLABE completos en logs deno · `audit_logs` sin PII/cifrado/hash (solo last4) · respuestas HTTP enmascaradas · descifrado sólo en `nomi-employee-identity` con `view_identity_sensitive` y auditoría del acceso sin valores.

## 5. Rate limiting (§10) — honesto
Implementado **local** en las Edge Functions: límite de tamaño de body (413), parseo seguro (400), método no permitido (405), validación temprana, respuestas genéricas. **NO existe control distribuido** (rate limit por IP/usuario a nivel gateway) → el módulo **no** está totalmente protegido contra abuso; pendiente infra (Kong rate-limit plugin o WAF).

## 6. Rotación de llaves (§11)
Campos añadidos: `nomi_employees.enc_key_version`, `nomi_employees.hmac_key_version`, `nomi_employee_bank_accounts.enc_key_version` (default 1). Procedimiento:
1. Publicar nueva llave como versión N+1 (env), conservar la anterior (doble lectura).
2. Descifrar con la versión del registro, re-cifrar con N+1, actualizar `enc_key_version` por lotes.
3. Para HMAC: recalcular `*_hash` con la nueva llave y actualizar `hmac_key_version` (afecta dedup → hacer en ventana controlada, validar unicidad).
4. Validar muestras, luego retirar la llave anterior del env. Auditar el evento de rotación.
No hay job automatizado (no requerido en esta fase); el esquema **ya no impide** la rotación.

## 7. Drift de migraciones (§12)
| Migración | Error (replay en limpio) | Afecta NóminaCheck | Bloquea despliegue nómina | Acción |
|---|---|---|---|---|
| 20260606000001 init | enum member_role incompleto | No | No | ✅ corregido (enum completo) |
| 20260611000001 company_trials | GROUP BY inválido | No | No | ✅ corregido |
| 20260617600000 seed_categories | `expense_categories.description` no existe | No | No | Reconciliación aparte |
| 20260618210000 cobracheck_complete | índice duplicado | No | No | Reconciliación aparte |
| 20260627/20260629030000/030003/20260630000002/20260708000005 | columna `status` (cascada) | No | No | Reconciliación aparte |
| 20260708000000 bancocheck | `detected_category` | No | No | Reconciliación aparte |
| 20260708000001 cobracheck_impl | `collector_id` | No | No | Reconciliación aparte |
| 20260715000000 wave6_wave8 | `member_role = text` (cast) | No | No | Reconciliación aparte |
| 20260715100000 signal_triggers | opciones de trigger conflictivas | No | No | Reconciliación aparte |

La migración de nómina **se aplica limpio** sobre el esquema real (probado: aplica + 53/53 + HTTP OK).
El folder NO es 100% replayable en limpio → **no se puede construir un staging idéntico a prod sólo con el repo** (esto es un pre-blocker del proceso de staging, no de la nómina). Reconciliación = tarea separada (requiere comparar contra el schema real de prod).

## 8. Runbook de despliegue (§14) — NO ejecutar sin autorización
**Previo:** snapshot/backup · verificar que `nomi_*` NO existe en prod · verificar `pgp_encrypt_secret/decrypt`, `touch_updated_at`, `member_role`, `companies`, `company_members`, `audit_logs` presentes · configurar secretos.
**Aplicación:** correr `20260722210000_nomicheck_secure_schema.sql` en SQL Editor → registrar versión en `schema_migrations` → `supabase functions deploy nomi-bank-account nomi-employee-pii nomi-employee-identity` → configurar `CFDI_ENC_KEY` + `NOMI_HMAC_KEY` → desplegar el web con los routes corregidos.
**Verificación:** 9 tablas + vistas · 21 policies · 12 funciones · 9 triggers · grants (sin DELETE, columnas cifradas no otorgadas, service_role con INSERT audit_logs + SELECT company_members) · Edge health · aislamiento por empresa · auditoría.
**Abortar si:** falta una policy · EXECUTE público en función definer · una prueba cruzada pasa cuando debía fallar · PII en logs · Edge sin autorización · error de cifrado · error en FlujoCheck · migración parcial · rollback no funcional.

## 9. Smoke tests postdespliegue (§15) — empresa/usuarios de PRUEBA controlados
owner autorizado · admin sin PII · superadmin sin acceso · contador sin PII · supervisor sin scope (0) · supervisor con scope · spender rechazado · empresa ajena rechazada · alta bancaria válida (enmascarada) · escritura+lectura PII autorizada · directorio · resumen agregado · aprobación (RPC) · auditoría presente · FlujoCheck 200/403 · DELETE rechazado.

## 10. Archivos modificados / creados (Fase 1A)
- `supabase/migrations/20260722210000_nomicheck_secure_schema.sql` (migración única)
- `supabase/functions/nomi-bank-account`, `nomi-employee-pii`, `nomi-employee-identity`
- `supabase/migrations/NOMICHECK_1A_TESTS.sql`, `NOMICHECK_1A_ROLLBACK.sql`, `NOMICHECK_1A_ENTREGA.md`, `NOMICHECK_1A_CIERRE.md`, `DRIFT_AUDIT_2026-07-22.md`
- FlujoCheck: `apps/web/app/api/flujocheck/dashboard/route.ts` (+ 4 routes web asegurados con `requireCompanyMember`), `apps/mobile/lib/flujocheck-logic.ts`
- Replayability histórica: `20260606000001_init.sql` (enum), `20260611000001_company_trials.sql` (GROUP BY)

## 11. Riesgos remanentes
Rate limiting distribuido (infra) · reconciliación del drift histórico (tarea aparte) · staging exacto de prod no reproducible sólo con el repo · lectura de PII sin UI aún (portal = Fase 1B).

## VEREDICTO
**FASE 1A CERRADA Y LISTA PARA DESPLIEGUE CONTROLADO** (con los caveats no bloqueantes de §11).
