# ContaCheck · C2B — Security Audit

> RLS, grants, capacidades, SECURITY DEFINER, auditoría, ausencia de DELETE. Verificado con pruebas (S1–S11).

## 1. Capacidades y segregación (probado)
- 11 capacidades `accounting.*`; `accounting_can(company, cap)` resuelve override de usuario OR mapeo por rol
  (global o por empresa), `SECURITY DEFINER`, `SET search_path = pg_catalog, public`.
- Defaults verificados: `owner`=todas; `admin`=view/configure/audit (**sin** post/reverse/close);
  `accountant`=view/generate/review/approve/post/audit; otros roles=ninguna.
- **Segregación aplicada en RPC:** `approve` exige aprobador ≠ generador; `post` exige contabilizador ≠
  aprobador (salvo `accounting.admin`). Pruebas S2/S3/E1.

## 2. RLS multiempresa (probado)
- Las 18 tablas nuevas con `ENABLE ROW LEVEL SECURITY` + política SELECT filtrando membresía activa
  (`company_members`); tablas hijas de reglas filtran vía join al padre.
- Aislamiento cross-company verificado: owner de empresa B **no** ve líneas de A (S8); no miembro no ve nada (S9).
- `service_role` bypassa RLS para adaptadores (S11, control).

## 3. Grants (probado)
- `REVOKE ALL … FROM anon` en todas las tablas nuevas.
- `authenticated`: **solo SELECT** en tablas de lectura; **sin INSERT/UPDATE/DELETE** directos → las escrituras
  van por RPC `SECURITY DEFINER`. Verificado que `authenticated` **no puede DELETE** líneas (S10).
- `service_role`: acceso completo (adaptadores).
- RPC: `REVOKE EXECUTE FROM public, anon` + `GRANT EXECUTE TO authenticated, service_role`; autorización real
  dentro de la función vía `accounting_can()`.

## 4. SECURITY DEFINER — endurecimiento
- Todas las RPC de escritura: `SECURITY DEFINER` + `SET search_path = pg_catalog, public` (anti-hijacking).
- Verifican `company_id` del llamador (membresía) + capacidad + estado + periodo dentro de la transacción.
- No devuelven secretos; los snapshots fiscales no incluyen CSD; el tercero solo expone `tax_id_last4`.

## 5. Inmutabilidad y ausencia de DELETE
- **Sin DELETE** concedido en tablas contables. Corrección solo por reversa (contra-asiento).
- Póliza `posted`: trigger `accounting_voucher_immutable_guard` bloquea cambios de importes/tipo/fecha/periodo/
  tercero/entries/folio (S/C2). Líneas de póliza posted: guards bloquean UPDATE/DELETE (C3).
- Versión de regla `published`: inmutable (trigger); cambios = versión nueva.

## 6. Auditoría (probado indirectamente)
- `accounting_log_audit()` escribe en `audit_logs` (genérica) en generate/validate/approve/post/reject/reverse/
  close/reopen/publish_rule/merge_party/set_flag. `entity_id` siempre real (audit_logs.entity_id NOT NULL).
- **No se registran** CSD, contraseñas ni RFC completo (solo `rfc_last4`/hash). `request_id` soportado en el
  registro de idempotencia.

## 7. PII (NóminaCheck)
- Los adaptadores de nómina (futuros) usan `nomi_employees.id`/`rfc_hash`; `parties` guarda solo hash+last4 para
  empleados. El RFC en claro de empleado nunca se copia a la contabilidad.

## 8. Observaciones de seguridad
- Al desplegar, revisar grants explícitos a `service_role` (lección F1A: faltaban `INSERT audit_logs`,
  `SELECT company_members`). En local el DB corre como superusuario; en prod validar con el rol real.
- `search_path` fijo confirmado en las funciones nuevas; auditar que ninguna función C2B quede sin él.
