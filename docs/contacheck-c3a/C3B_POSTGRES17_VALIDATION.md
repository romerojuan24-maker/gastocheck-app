# ContaCheck · C3A.2 — Validación del paquete C3B en PostgreSQL 17 (§4)

> **Estado: VALIDADO (mayoría de escenarios ejecutados en PG17 real).** Docker se recuperó durante la sesión y se
> ejecutaron los envoltorios y escenarios adversariales contra el stack local (PG 17.6).

## Suite de C2B re-ejecutada (§8)
Sobre el estado aplicado: **46/46 PASS** (SQL 25 + RLS 11 + pilotos 10), 0 FAIL, 0 ERROR. Con las **3 de
concurrencia** ya validadas = **49/49**. Los 16 bloques del paquete son **idénticos por checksum** a los
validados → resultado vigente.

## Envoltorios y escenarios ejecutados (PG17)
| Escenario (§4.1) | Resultado |
|---|---|
| **3. C2B parcialmente aplicado** → `00_preflight` debe abortar | ✅ **ABORTA** ("C2B parcialmente aplicado, ya existen: …18 tablas") |
| **1. Baseline limpio** (tras rollback) → `00_preflight` debe pasar | ✅ **PREFLIGHT OK** |
| Falta de aprobación (`-v approved` ausente) | ✅ **ABORTA** ("falta -v approved=YES") |
| Aplicar los **16 bloques del paquete** (01..16) | ✅ **aplican OK** (sin error) |
| `17_postflight` | ✅ **8/8 PASS** + POSTFLIGHT OK (18 tablas, 41 cols, voucher_number nullable, funciones núcleo, search_path fijo, RLS, LEGACY, sin duplicados) |
| `19_feature_flag_verification` | ✅ **FLAG CHECK OK** (todas LEGACY) |
| `20_rollback_readiness` | ✅ **OK** (0 posted → rollback lógico seguro) |
| **8. Reejecución** sobre aplicado / **4. colisión** | ✅ `00_preflight` **ABORTA** (detecta estado ya aplicado) |
| **10. Rollback y reapply** | ✅ ejecutado (rollback → 0 tablas → reapply 16 → postflight PASS) |

## Escenarios NO ejecutados individualmente (mecanismo probado, cobertura parcial)
| Escenario | Estado |
|---|---|
| 2. BancoCheck parcialmente aplicado | No aislado; `00_preflight` no depende de esas cols → continuaría (por diseño) |
| 5. Política RLS conflictiva | No simulado; bloque 15 no toca políticas legacy (revisión estática) |
| 6. `accounting_vouchers` no vacío | No simulado; postflight verifica sin duplicados |
| 7. `accounting_accounts_v2` no vacío | **Guard existe** en `00_preflight` (aborta si v2>0); no simulado con datos |
| 9. Interrupción tras cada bloque | No simulado; `ON_ERROR_STOP` corta y el bloque queda revertido (transaccional) |

**Honestidad:** los guards clave (partial-apply, colisión, v2 no vacío, aprobación, balance) están **en el
código y los ejecutados funcionan**; los escenarios 2/5/6/7/9 no se sembraron con datos específicos. Cobertura
suficiente para confiar en los envoltorios; recomendable sembrar 5/7 antes del apply real.

## Criterio de aceptación (§4.2)
Cumplido en lo ejecutado: se **detiene ante drift** (escenarios 3/4), **falla con mensajes claros**, **no oculta
diferencias** (aborta en vez de `IF NOT EXISTS` silencioso), **no duplica**, **conserva LEGACY**, **pasa
postchecks**. ✅

## Checksums (§5)
Los 16 bloques **no se modificaron** (validados por `sha256sum -c` = OK). No se regeneró `MANIFEST.json`/
`CHECKSUMS.sha256` porque **ningún archivo del paquete cambió**. Si se corrige algún envoltorio tras sembrar 5/7,
regenerar y re-verificar.
