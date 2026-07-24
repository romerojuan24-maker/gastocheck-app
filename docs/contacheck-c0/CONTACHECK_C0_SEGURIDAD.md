# ContaCheck · C0 — Seguridad

> Cómo ContaCheck hereda el modelo de seguridad existente y qué exige por ser un módulo con datos fiscales.
> Read-only; sin implementación.

## 1. Reutilizar el modelo existente (no crear paralelos)

### Multi-tenant + RLS
- Aislamiento por `company_id` en todas las tablas, patrón ya universal en el repo.
- Helpers SECURITY DEFINER: `auth_is_member(company)`, `auth_role(company)`, `auth_can_view_all`,
  `auth_can_authorize` (`init.sql:64-91`). ContaCheck los reutiliza; **no** define auth propio.

### Roles contables ya existentes
- Enum `member_role` incluye **`accountant`** y **`contador_general`** — son los roles con derecho a
  validar/contabilizar. La RLS contable existente ya los contempla.
- Patrón **VoBo del contador** ya implementado en BancoCheck (`bancocheck_approve_suggestion` exige rol
  owner/admin/supervisor/accountant/contador_general) → ContaCheck adopta el mismo gate para "contabilizar".

### Capacidades granulares (patrón NóminaCheck)
- NóminaCheck introdujo capacidades/scopes (`nomi_can`, `nomi_in_scope`) más finas que el rol. ContaCheck
  puede seguir el mismo patrón para separar: **ver** libro, **proponer** póliza, **validar/contabilizar**,
  **exportar**, **cerrar período**. Recomendado para segregación de funciones (control interno).

### Auditoría
- `audit_logs` genérica (`entity_type`, `old_values`/`new_values jsonb`, `reason`, `ip`, `user_agent`).
  Todo asiento/póliza/cancelación de ContaCheck deja rastro aquí. **Inmutabilidad:** una vez contabilizado,
  no se borra — se cancela con contra-asiento (cierra P9).

## 2. PII y datos sensibles (crítico por NóminaCheck)
- `nomi_employees` guarda **RFC/NSS/CURP cifrados** (pgcrypto, `encrypted_*` + `*_hash` + `*_last4`);
  cuentas bancarias de empleado cifradas. Claves en env (`CFDI_ENC_KEY`, `NOMI_HMAC_KEY`).
- **Regla para ContaCheck:** el adaptador de nómina entrega **id de empleado / hash**, nunca RFC/NSS en
  claro. Las pólizas de nómina se totalizan por concepto/póliza — **no** se listan RFC individuales en el
  libro. Descifrar PII sigue restringido a las Edge Functions con capacidad, nunca a ContaCheck.
- Nunca poner PII ni valores fiscales sensibles en URLs/query params.

## 3. Frontera de confianza
- Las Edge Functions de nómina imponen doble gate (Kong JWT + auth propia por capacidad). ContaCheck, si
  expone Edge Functions, debe replicar: **verificar JWT + membresía + capacidad** con el JWT del llamador
  (no service_role para autorizar), como ya se corrigió en los routes web (`requireCompanyMember`).
- **Grants mínimos:** la experiencia de F1A mostró que faltaban grants a `service_role`
  (`INSERT audit_logs`, `SELECT company_members`). ContaCheck debe auditar sus grants explícitamente.

## 4. Integridad contable como control de seguridad
- Invariante `Σdebe = Σhaber` a nivel BD (`accounting_vouchers` ya tiene `CHECK`). ContaCheck lo mantiene.
- Idempotencia (`idempotency_key`) evita doble contabilización (riesgo de fraude/error).
- Cierre de período: una vez cerrado, los movimientos del período no se re-contabilizan (solo ajustes con
  póliza nueva) — control a diseñar en C1.

## 5. Riesgos de seguridad heredados a vigilar
- **`validate_cfdi_with_sat` simulada** → un CFDI "válido" no está verificado realmente (riesgo de
  deducir/acreditar sobre comprobantes apócrifos). Cerrar antes de confiar el acreditamiento (P4).
- **Drift de prod** → verificar objetos reales antes de asumir RLS aplicada (X4).
- **Mapeo de cuentas hardcodeado** en cliente (mobile/web) → mover a servidor evita manipulación (P8).

## 6. Checklist de seguridad para C1 (resumen)
- [ ] RLS por `company_id` en todas las tablas nuevas de ContaCheck.
- [ ] Autorización por capacidad + VoBo contador para contabilizar/cerrar.
- [ ] Cero PII de nómina en el libro (solo ids/hashes/totales).
- [ ] Auditoría inmutable en `audit_logs`; cancelación por contra-asiento.
- [ ] Grants explícitos y mínimos; JWT del llamador para autorizar.
- [ ] Validación SAT real antes de acreditar IVA.
