# ContaCheck · C3A.1 — Revisión del paquete C3B (§7, §8, §10, §11)

> Revisión del paquete `deploy/contacheck-c3b/`. **No ejecutado.**

## Contenido (21 SQL + metadatos)
`00_preflight` · `01..16` (16 bloques C2B, copia fiel verificada por checksum) · `17_postflight` ·
`18_smoke_tests` · `19_feature_flag_verification` · `20_rollback_readiness` · `MANIFEST.json` ·
`CHECKSUMS.sha256` · `README.md` · `RUNBOOK.md` · `STOP_CONDITIONS.md`.
**No incluye** migraciones históricas ajenas (§7 cumplido). Los 16 bloques son idénticos (sha256) a
`supabase/migrations/20260724000001..16`.

## §8 — Control transaccional por bloque
| Bloque | Transaccional | Lock esperado | Duración (volumen real) | Abortar si | Reintentable | Si parcialmente aplicado |
|---|---|---|---|---|---|---|
| 01,02,04,05,08–14,16 | **Sí** | mínimo (CREATE) | ms | error de CREATE | Sí | rollback lógico + reintento |
| 03 (ALTER accounting_accounts) | **Sí** | ACCESS EXCLUSIVE breve (301 filas; ADD COLUMN metadata-only PG17) | ms | v2 no vacío / error | Sí | rollback lógico |
| 06 (ALTER accounting_vouchers) | **Sí** | ACCESS EXCLUSIVE breve (0 filas) | ms | error CHECK/columna | Sí | rollback lógico |
| 07 (numbering) | **Sí** | breve (0 filas) | ms | duplicados voucher_number | Sí | rollback lógico |
| 15 (RLS/grants) | **Sí** | breve | ms | política preexistente incompatible | Sí | rollback lógico |
| 00,17,19,20 | Sí (solo lectura) | — | ms | condición no cumplida | Sí | n/a |
| 18 (smoke) | **Sí (BEGIN..ROLLBACK)** | breve | ms | error no esperado | Sí | ROLLBACK integrado (no persiste) |

**Idempotencia:** los bloques usan `IF NOT EXISTS`/`CREATE OR REPLACE`. **No se oculta drift**: el `00_preflight`
aborta si un objeto C2B ya existe (partial apply) o si hay colisión de función/columna, en vez de enmascararlo con
`IF NOT EXISTS`. El postflight verifica el shape exacto (41 cols, 18 tablas, search_path, RLS).

## §9 — Prechecks bloqueantes (00_preflight)
Aborta si: falta aprobación (`-v approved`) o backup (`-v backup_confirmed`); falta tabla base; faltan auth
helpers; `member_role` sin roles requeridos; **cualquier tabla C2B ya existe** (partial apply); `accounting_vouchers`
ya tiene columnas C2B; **`accounting_accounts_v2` dejó de estar vacío**; pólizas desbalanceadas; **colisión de
función** `accounting_*`. ✅ cubre los disparadores del §9. *(La confirmación de proyecto/base es un paso manual
del RUNBOOK — `current_database()` se imprime; no se almacena secreto ni bypass.)*

## §10 — Postchecks
`17_postflight` valida: 18 tablas, 41 columnas de `accounting_vouchers`, funciones núcleo, `search_path` en
SECURITY DEFINER, RLS en tablas C2B, flags en LEGACY, sin duplicados por idempotency_key, y lista constraints/
índices/triggers esperados. `19` confirma 0 SHADOW/CONTACHECK. `20` confirma readiness de rollback.

## §11 — Validación local
- **Los 16 bloques** ya se validaron en local en C2B (**49/49**, apply→rollback→reapply). **No se modificaron** →
  no se re-ejecutaron pruebas (no era necesario).
- **Los envoltorios nuevos** (`00,17,18,19,20`) son SELECT/DO de solo lectura (salvo el smoke, que hace
  BEGIN..ROLLBACK). Su **lógica reproduce consultas ya ejecutadas con éxito** contra el DB local en C2B/C3A.
  **Limitación honesta:** su **validación de sintaxis contra el DB local quedó pendiente** porque el engine de
  Docker se cayó al final de la sesión; deben ejecutarse una vez (staging o local restaurado) antes del apply real.
  Están escritos para objetos cuyos nombres se verificaron en C2B.

## Riesgos residuales del paquete
- Validación de sintaxis de los 5 envoltorios contra un Postgres real: **pendiente** (Docker caído).
- Colisión de funciones en prod: **pendiente `06`** (el preflight la atrapa, pero conviene saberlo antes).

## Veredicto del paquete
**LISTO estructuralmente** (aislado, con checksums, control transaccional, pre/postchecks, stop conditions y
rollback). Condicionado a: ejecutar los 5 envoltorios una vez en un Postgres real y a los prechecks `05/06/07` +
backup.
