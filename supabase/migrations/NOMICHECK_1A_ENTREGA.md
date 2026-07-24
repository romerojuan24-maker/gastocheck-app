# NóminaCheck — Fase 1A endurecida · Entrega para revisión

Incorpora la revisión externa (GPT). Todo es **archivo en repo, NO aplicado a prod**.
Las tablas `nomi_*` no existen en producción, así que se construye el modelo ya blindado
y granular desde cero (sin estado inseguro intermedio, sin migración de datos).

## Archivos
- **`20260722210000_nomicheck_secure_schema.sql`** — esquema completo endurecido (único a correr).
- Edge Functions: **`nomi-employee-pii`** (cifra RFC/NSS/CURP + hash ciego) y **`nomi-bank-account`** (cifra cuenta/CLABE).
- FlujoCheck: [`route.ts`](../../apps/web/app/api/flujocheck/dashboard/route.ts) (fix de auth) y [`flujocheck-logic.ts`](../../apps/mobile/lib/flujocheck-logic.ts).
- `NOMICHECK_1A_TESTS.sql` (⚠️ pendiente de reescribir al modelo granular), `DRIFT_AUDIT_2026-07-22.md`.

## Cómo se atendió cada punto de la revisión
| Punto GPT | Acción |
|---|---|
| admin recibía todo lo sensible | **admin** = solo view_aggregate, view_employee_directory, manage_employees, manage_incidents. Lo sensible se otorga explícito. |
| superadmin acceso automático | **superadmin = 0 capacidades** por default; acceso solo por excepción temporal auditada (`nomi_user_capabilities`). |
| accountant demasiado amplio | accountant/contador_general = agregado + detalle nómina + directorio + banca enmascarada + calcular + export contable + auditar. **Sin** identidad sensible, banca full, manage_employees, incidencias, approve. |
| separar agregado vs detalle | Capacidades separadas: `view_aggregate`, `view_payroll_detail`, `view_employee_directory`, `view_identity_sensitive`, `view_bank_masked/full`, `view_own_payroll`. Resumen por RPC `nomi_payroll_summary` (sin PII). |
| supervisor sin alcance | Tabla **`nomi_user_scopes`** + función `nomi_in_scope`. Supervisor solo ve/gestiona empleados dentro de su alcance (company/department/employee). Sin alcance = no ve nada. |
| cifrar NSS/RFC/CURP | Columnas `encrypted_*` + `*_hash` (HMAC ciego) + `*_last4`. RFC único por empresa vía `rfc_hash`. Escritura solo por Edge `nomi-employee-pii`. |
| aprobación trigger vs RPC | **Ambos**: RPC `nomi_approve_payroll` (flujo + bloqueo optimista `version` + segregación) y trigger `nomi_payroll_approval_guard` como invariante inviolable. |
| vista directorio definer riesgosa | **Eliminada**. Reemplazada por RPC `nomi_get_employee_directory` (SECURITY DEFINER, solo columnas no sensibles, aplica alcance). |
| FlujoCheck service_role | **Corregido**: el route ahora exige JWT, verifica membresía activa + rol financiero, rechaza company_id ajeno. (Endpoint resultó sin llamador activo; fix de defensa en profundidad.) |
| EXECUTE de public | `REVOKE EXECUTE ... FROM PUBLIC, anon` en todas las funciones nomi; GRANT solo a authenticated (o service_role para cifrado/hash). |
| default privileges / DELETE | `REVOKE ALL ... FROM PUBLIC, anon, authenticated` antes de grants precisos; DELETE nunca otorgado; columnas PII/cifradas no otorgadas al cliente. |
| deny > owner, active, valid ranges, UPDATE con USING+CHECK | Ya estaban; además `nomi_can` rechaza capacidades fuera de catálogo. |

## Puntos abiertos / pendientes
1. **Reescribir `NOMICHECK_1A_TESTS.sql`** al modelo granular (capacidades nuevas, scopes, PII). Correr 22/22 en local/staging.
2. **Probar** ambas Edge Functions (PII y banca) con JWT real; configurar env `CFDI_ENC_KEY` y **`NOMI_HMAC_KEY`**.
3. `view_own_payroll`: capacidad y política self ya existen, pero el portal del empleado es Fase 1B (sin pantalla aún).
4. Banca: la Edge tiene idempotencia por cuenta primaria; falta rate-limiting/lock de concurrencia formal (infra).
5. Aplicar migración en prod + **registrar la versión** en `schema_migrations` (evitar más drift).
6. Tarea aparte lanzada: auditar el mismo patrón `service_role`-sin-auth en los otros routes web.

## Estado de las pruebas (EJECUTADAS)
`NOMICHECK_1A_TESTS.sql` — **32 casos SQL/RLS → 42/42 asserts PASS**, ejecutados sobre un Postgres
real (imagen `supabase/postgres` 17.6, aislado en Docker) con roles y JWTs impersonados
(`SET ROLE authenticated` + `request.jwt.claims`). Cubren owner, admin sin/con excepción, contador,
supervisor con/sin alcance, spender, cobrador, no-miembro, empleado propio/ajeno, DELETE,
salario/banca/PII sin permiso, approve sin capacidad, **autoaprobación/segregación**, acceso
cruzado, vistas/RPC, **índice ciego rfc_hash**, **deny>allow**, expiración.

La ejecución real cazó **un bug de la migración**: la columna `position` (palabra reservada)
necesitaba comillas en el `RETURNS TABLE` de `nomi_get_employee_directory` — habría fallado al
aplicar. Corregido. También se corrigieron 3 detalles del harness de pruebas (GUC portable para
`auth.uid()`, valor de asistencia `ausente`, y verificación de RLS-0-filas para el salario).

> ⚠️ Nota importante: el folder `supabase/migrations/` **NO es replayable en limpio** (`supabase
> start` falla en `20260608000003` porque una policy usa el valor de enum `admin` antes de que exista).
> Por eso las pruebas se corrieron aislando la migración de nómina con un bootstrap mínimo de
> prerequisitos, NO con `supabase db reset`. Esto confirma el drift ya documentado.

Pendiente: los casos de **integración** (doble envío bancario, concurrencia real, cifrado/HMAC con
llave de env, acceso cruzado al endpoint web) requieren las Edge Functions desplegadas.

## Riesgos remanentes
1. Lectura descifrada de RFC/NSS/CURP para `view_identity_sensitive` aún no tiene Edge de descifrado (solo last4). Se difiere a 1B (sin pantalla aún).
2. Rotación de llaves (`CFDI_ENC_KEY`, `NOMI_HMAC_KEY`): al rotar hay que re-cifrar/re-hashear; no hay job de rotación (documentado, no implementado).
3. Auditoría por trigger no captura `request_id`/IP (no disponibles en contexto de trigger); las Edge Functions sí pueden añadirlos.
4. `cost_center`/`team`/`self` existen en el catálogo de scope pero se resolverán cuando existan esos campos (Fase 4/portal).
5. Rate-limiting/lock de concurrencia formal en las Edge Functions: pendiente (infra).

## Despliegue (para cuando autorices — NO ejecutar aún)
1. **Respaldo**: snapshot/backup de la BD antes de aplicar.
2. **Aplicar**: correr `20260722210000_nomicheck_secure_schema.sql` en el SQL Editor (idempotente).
3. **Registrar versión**: `insert into supabase_migrations.schema_migrations(version,name) values ('20260722210000','nomicheck_secure_schema');`
4. **Verificar**: existencia de las 9 tablas nomi_*, funciones (`nomi_can`, `nomi_in_scope`, RPCs), policies por operación, grants (sin DELETE, columnas cifradas no otorgadas).
5. **Secretos**: `supabase secrets set NOMI_HMAC_KEY=... CFDI_ENC_KEY=...`
6. **Edge Functions**: `supabase functions deploy nomi-employee-pii nomi-bank-account`
7. **Smoke test**: crear empresa de prueba, alta empleado, set PII vía Edge, verificar last4 y que el cliente no ve columnas cifradas.

## Reversión (rollback)
- Todo es aditivo y NADA existe en prod hoy → el rollback seguro es **DROP de los objetos nomi_***
  (tablas, funciones, RPCs) y quitar el registro de versión. Al no haber datos previos, no hay
  pérdida. **Nunca** revertir reactivando `FOR ALL` sin rol ni DELETE físico.
- Si ya hubiera datos: no borrar; deshabilitar vía política restrictiva temporal y revisar.

## No incluido (Fase 1B+, no autorizado)
Pantallas/portal, prenómina, ISR/IMSS/INFONAVIT, CFDI de nómina, dispersión bancaria.

## Nota legal (de GPT, correcta)
La LFPDPPP de 2010 fue sustituida por la nueva ley publicada el 2025-03-20. El cifrado aquí se
justifica por **reducción de riesgo y minimización de exposición**, no por citar una obligación
específica de cifrar un campo con un algoritmo dado. Revisión jurídica: sobre el texto vigente.
