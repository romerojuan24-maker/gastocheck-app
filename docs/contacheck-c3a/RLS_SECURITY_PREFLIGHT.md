# ContaCheck · C3A — RLS & Security Preflight (§9)

> Solo lectura. El detalle interno de políticas requiere `scripts/contacheck-c3a/07` (PostgREST no expone
> `pg_policies`).

## Lo verificable hoy
- Las tablas base que C2B toca (`accounting_accounts`, `accounting_vouchers`, `expenses`, `bank_transactions`,
  `company_members`, `audit_logs`) **existen** y están expuestas por PostgREST bajo `service_role` (esperado).
- Las 18 tablas nuevas de C2B **no existen** aún → sus políticas se crean en el bloque 15 (con RLS por empresa,
  SELECT-only para `authenticated`, sin DELETE). No hay nada preexistente que colisione.

## Lo que DEBE confirmarse con `07` antes del GO (no visible por REST)
| Control | Qué buscar | Riesgo si falla |
|---|---|---|
| RLS habilitado en `accounting_vouchers`/`accounting_accounts` | `relrowsecurity=true` | Fuga multiempresa |
| Políticas existentes (USING/WITH CHECK/roles) | comparar con las validadas localmente | Política **más permisiva** que la probada |
| Políticas duplicadas o contradictorias | nombres repetidos / permisivas OR | Bypass |
| Grants directos a `anon`/`authenticated` | **ningún** `DELETE`/`ALL` inesperado | Escritura/borrado directo |
| Owner de las tablas | rol esperado (postgres/supabase_admin) | Bypass por ownership |
| Vistas `SECURITY DEFINER` | `nomi_cashflow_commitments` usa `security_invoker=on` (verificar) | Bypass de RLS por vista |
| `service_role` | acceso completo (esperado para adaptadores) | — |

## Notas de seguridad conocidas (de fases previas)
- `accounting_vouchers` en prod conserva sus políticas legacy (`20260705130000`): SELECT por miembro, INSERT
  para accountant/admin/owner/superadmin, **sin UPDATE/DELETE** → C2B **no** las modifica (compat LEGACY).
- Lección F1A: al desplegar objetos nuevos, revisar grants explícitos a `service_role` (faltaban `INSERT
  audit_logs`, `SELECT company_members`). Aplicar la misma verificación a las tablas/funciones de C2B tras aplicar.

## Estado del control
**WARNING (parcialmente verificado).** La superficie nueva de C2B se diseñó con RLS por empresa y sin DELETE
(validado localmente 11/11). Falta confirmar en prod, con `07`, que **no existan políticas preexistentes más
permisivas** sobre las tablas base ni vistas `SECURITY DEFINER` que hagan bypass. Sin esa confirmación no se
declara PASS.
