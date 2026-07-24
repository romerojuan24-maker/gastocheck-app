# ContaCheck · C2B — Resultados de Pruebas SQL

> Ejecutadas con `docker exec … psql` sobre el DB local. Archivos: `supabase/tests/contacheck_c2b/`.
> **25/25 PASS** (estructura, ciclo, balance, idempotencia, inmutabilidad, periodos, segregación, reversa,
> reglas, parties). Más **11/11** de seguridad (ver `SECURITY_AUDIT.md`).

## Fixtures (`00_fixtures.sql`)
Empresas A/B, usuarios owner/accountant/admin/spender, catálogo (cuentas afectables + una inactiva `9999` + una
no afectable `6000P`), perfil fiscal vigente, ejercicio 2026 + 12 periodos, policy + expenses de prueba.
Teardown con `session_replication_role=replica` para poder purgar datos posted de prueba.
Resultado: `PASS: 12 periodos creados` · `FIXTURES OK`.

## Suite `10_sql_tests.sql`
| Caso | Verifica | Resultado |
|---|---|---|
| A1 | validate → `validated` | PASS |
| A2 | post → `posted` | PASS |
| A3 | folio compuesto `EXPENSE-2026-000001` | PASS |
| A4 | periodo asignado | PASS |
| A5 | balance 1160 = 1160 | PASS |
| A6 | snapshot fiscal (rfc) en la póliza | PASS |
| A7 | `source_link` de tipo `origin` | PASS |
| B1 | misma idempotency_key + hash → mismo voucher | PASS |
| B2 | misma key + hash distinto → `IDEMPOTENCY_CONFLICT` | PASS |
| C1 | línea con débito y crédito ambos > 0 → rechazada | PASS |
| C2 | UPDATE de encabezado `posted` → rechazado | PASS |
| C3 | UPDATE de línea `posted` → rechazado | PASS |
| D1 | post en periodo cerrado → `PERIOD_NOT_OPEN` | PASS |
| E1 | mismo usuario genera y aprueba → `SEGREGATION_VIOLATION` | PASS |
| F1 | reversa marca `reversed_by` en original | PASS |
| F2 | reversa `posted` ligada (`reversal_of`) | PASS |
| F3 | totales invertidos en la reversa | PASS |
| F4 | reversa duplicada → `ALREADY_REVERSED` | PASS |
| G1 | regla `active` tras publicar | PASS |
| G2 | resolución devuelve 3 líneas | PASS |
| G3 | dos reglas igual prioridad → `RULE_AMBIGUOUS` | PASS |
| G4 | publicar regla con cuenta inactiva → rechazada | PASS |
| H1 | dedup de party por RFC normalizado | PASS |
| H2 | RFC genérico (`XAXX010101000`) no deduplica | PASS |
| I1 | `get_voucher_by_source` encuentra la póliza | PASS |

**Total: 25 PASS / 0 FAIL.**

## Precisión decimal
El balance usa `numeric(15,2)`; los casos de retenciones (pilotos GC1: 1000+160 = 106.67+100+953.33) cuadran a
centavo exacto. El `CHECK(total_debit=total_credit)` y el trigger diferible atrapan diferencias de centavos.

## Estructura / constraints verificados
`accounting_voucher_lines`: `acc_line_debit_xor_credit`, `acc_line_nonneg`, `UNIQUE(voucher_id,line_number)`, FKs
a company/voucher/account/party, trigger diferible de balance. `accounting_vouchers`: 41 columnas, CHECKs de
status/type ampliados, `CHECK(total_debit=total_credit)`, unicidad de folio compuesta + legacy.
