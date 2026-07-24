# ContaCheck · C2A — Seguridad y RLS

> §17 capacidades granulares, RLS multiempresa, RPC SECURITY DEFINER, segregación de funciones. Especificación
> para C2B. Reutiliza el patrón de capacidades de NóminaCheck.

## 1. Modelo de capacidades (mirror de NóminaCheck)
NóminaCheck ya define `nomi_capabilities`/`nomi_role_capabilities`/`nomi_user_capabilities` + `nomi_can()`
(`20260722210000_nomicheck_secure_schema.sql`). ContaCheck replica el patrón:
- `accounting_capabilities(key, description)` — semilla con las claves abajo.
- `accounting_role_capabilities(company_id NULL=global, role member_role, capability_key)` — mapeo por rol.
- `accounting_user_capabilities(company_id, user_id, capability_key, granted_by)` — overrides por usuario.
- Función `accounting_can(p_company uuid, p_capability text) returns boolean` — SECURITY DEFINER,
  `SET search_path = pg_catalog, public`, resuelve por rol (`company_members.role`) + overrides.

### Capacidades (§17)
`accounting.view · accounting.configure · accounting.generate · accounting.review · accounting.approve ·
accounting.post · accounting.reverse · accounting.close_period · accounting.reopen_period · accounting.audit ·
accounting.admin`.

### Roles por defecto (conservadores, con segregación)
| Rol (`member_role`) | Capacidades por defecto |
|---|---|
| `owner` | todas |
| `contador_general` | view, configure, generate, review, approve, post, reverse, close_period, audit |
| `accountant` | view, generate, review, post, audit (**no** approve ni reverse ni close → segregación) |
| `admin` | view, audit |
| `supervisor` | view (de su ámbito) |
| resto (`spender/office/cobrador/…`) | ninguna |

**Segregación de funciones (obligatoria):** `generate` ≠ `approve` ≠ `post`. Un mismo usuario no debe tener a la
vez `approve` y `post` sobre la misma póliza salvo `owner`/`admin` explícito (regla validada en las RPC, patrón
`nomi_payroll_approval_guard` `20260722210000:532-535`). `reverse` y `close_period` son de nivel contador general.

## 2. RLS por tabla (todas multiempresa)
Patrón base (como `nomi_*` y `accounting_vouchers` actual `20260705130000:127-139`): `ENABLE ROW LEVEL SECURITY`
+ política por operación filtrando `company_id IN (SELECT company_id FROM company_members WHERE user_id=auth.uid()
AND status='active')` **y** capacidad vía `accounting_can()`.

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `accounting_vouchers` | `accounting.view` | vía RPC (`accounting.generate`) | **solo RPC de estado**; nunca libre; **nada si `posted`** | **ninguno** |
| `accounting_voucher_lines` | `accounting.view` | vía RPC | ninguno si voucher `posted` | ninguno |
| `accounting_source_links` | `accounting.view` | vía RPC | ninguno | ninguno |
| `accounting_periods`/`fiscal_years` | `accounting.view` | `accounting.admin` | `accounting.close_period`/`reopen_period` (vía RPC) | ninguno |
| `accounting_accounts` (v1) | miembro | `accounting.configure` | `accounting.configure` | restringido (no si referenciada) |
| `accounting_rules*` | `accounting.view` | `accounting.configure` | `accounting.configure` (solo draft) | solo draft |
| `parties`/`party_links` | miembro | `accounting.configure` o módulos | `accounting.configure` | ninguno (merge, no delete) |
| `company_tax_profiles` | miembro | `accounting.admin` | `accounting.admin` | ninguno |
| `accounting_capabilities*` | miembro | `accounting.admin` | `accounting.admin` | `accounting.admin` |

## 3. RPC SECURITY DEFINER (endurecimiento)
Todas las RPC de escritura contable son `SECURITY DEFINER` con:
- `SET search_path = pg_catalog, public` (evita hijacking; patrón `nomi_blind_hash` `20260722210000:24-30`).
- `REVOKE EXECUTE ... FROM public, anon;` `GRANT EXECUTE ... TO authenticated;` (autorización real dentro de la
  función vía `accounting_can()` con el JWT del llamador — **no** confiar solo en el grant).
- Validan `company_id` del llamador (membresía activa) + capacidad + estado + período dentro de la transacción.
- **service_role:** para adaptadores automáticos (generación desde eventos) se usa `service_role` con la RPC,
  pero la autorización de negocio (VoBo/post) siempre exige capacidad de un usuario real.

## 4. Auditoría e inmutabilidad
- **Sin DELETE físico** en ninguna tabla contable (RLS sin DELETE; corrección por reversa). Patrón nómina
  (`20260722210000:375` REVOKE ALL + grants selectivos).
- Toda acción de estado (generate/approve/post/reverse/close) escribe `audit_logs`
  (`entity_type='contacheck_voucher'|'contacheck_period'|'contacheck_rule'`, `old_values`/`new_values`,
  `20260608000003:361-377`).
- **Metadata sensible:** `tax_profile_snapshot` no incluye secretos CSD; PII de tercero solo `tax_id_last4`/hash.
- **Grants mínimos:** revisar explícitamente (lección F1A: faltaban `INSERT audit_logs`, `SELECT company_members`
  a `service_role`).

## 5. Aislamiento y pruebas
Toda tabla lleva `company_id`; ninguna RPC cruza empresas. Pruebas de RLS con 2 usuarios de empresas distintas
+ 2 conexiones concurrentes (ver Plan de Pruebas).
