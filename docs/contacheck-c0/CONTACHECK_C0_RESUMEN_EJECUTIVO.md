# ContaCheck · C0 — Resumen Ejecutivo

> **Fase:** C0 · Auditoría de integración y diseño no invasivo (SOLO LECTURA).
> **Alcance:** No se escribieron migraciones, no se implementó ContaCheck, no se modificó ningún
> módulo, no se aplicó nada a producción. Este paquete describe el terreno y propone la estrategia.
> **Fecha:** 2026-07-23.

## Tesis en una frase
**La contabilidad NO parte de cero: ya existe una capa contable en el repo, pero está fragmentada,
duplicada y a medio cablear.** ContaCheck debe ser una **capa de contabilización no invasiva** que
*consuma* movimientos normalizados de cada módulo vía adaptadores y *produzca* pólizas balanceadas
sobre el catálogo de cuentas **vivo** (`accounting_accounts`), reutilizando roles, auth y auditoría
existentes — **no** un módulo nuevo que reinvente catálogo, terceros ni pólizas.

## Los 5 hallazgos que definen el diseño

1. **Ya hay motor contable, aislado en GastoCheck.**
   `20260623000001_gastocheck_contabilidad_integration.sql` tiene `accounting_entries` (asientos
   debe/haber), `generate_accounting_entries()`, `export_policy_contpaqui()`. Pero: contrapartida
   **hardcodeada `'1010'`**, `validate_cfdi_with_sat()` **simulada**, no está cableado al UI, y está
   desconectado del export real que usa la app (`generate-export` lee `receipts`, no `accounting_entries`).

2. **BancoCheck es el módulo contablemente más maduro.** Ya liga movimientos a cuentas reales
   (`bank_transactions.accounting_account_id` → `accounting_accounts`), tiene `accounting_vouchers`
   (pólizas con `CHECK total_debit = total_credit`), un generador de pólizas balanceadas
   (`apps/web/lib/poliza.ts`, separa IVA acreditable 16 %) y **VoBo del contador**. Es el patrón a generalizar.

3. **Catálogo de cuentas DUPLICADO — decisión bloqueante.** `accounting_accounts` (el **vivo**, con UI
   administrable en `apps/mobile/app/catalogo-cuentas.tsx`, usado por BancoCheck y pólizas) vs
   `accounting_accounts_v2` (más rico: `nature`, `is_deductible`, `requires_cfdi`, pero **huérfano**).
   Peor: `expenses.accounting_account_id` tiene **dos FK conflictivas**, a v1 y a v2.

4. **No hay "party master".** Terceros fragmentados en `suppliers`, `cobra_clients`, `cfdi_clients`,
   `fleet_clients`. La misma persona se duplica por módulo. La contabilidad necesita RFC + régimen por
   tercero → hoy tendría que consolidar 4 tablas. (Coincide con la decisión pendiente de Juan sobre
   unificación en `parties`.)

5. **CobraCheck, FlujoCheck y NóminaCheck no tocan contabilidad.** CobraCheck (CxC) y NóminaCheck
   (nómina) generan movimientos claramente contabilizables pero **cero pólizas/asientos**. FlujoCheck es
   un **proyector de tesorería**, no una fuente contable (no debe contabilizarse).

## Madurez por módulo (evidencia en los docs de detalle)

| Módulo | Operativo | Integración contable |
|---|---|---|
| **BancoCheck** | Funcional c/ pendientes | **Parcial-avanzada** (única con clasificación a cuenta real + póliza balanceada) |
| **GastoCheck** | Funcional c/ pendientes | **Esqueleto** (motor existe, no cableado; contrapartida fija; SAT simulado) |
| **CobraCheck** | Funcional c/ pendientes | **Nula** |
| **NóminaCheck** | Backend funcional (desplegado F1A) | **Nula** (aún sin UI; Fase 1B) |
| **FlujoCheck** | Parcial (proyector) | **N/A** (no es fuente contable) |

## Recomendación de arquitectura (no invasiva)
Un **contrato normalizado** de "movimiento contabilizable" + **un adaptador por módulo** que traduce el
*evento que confirma el movimiento* (la transición de estado que ya existe) a ese contrato. ContaCheck
consume el contrato, aplica reglas de partida doble (cuenta + contrapartida + IVA/retenciones) y emite
pólizas balanceadas a un **libro unificado** (`accounting_vouchers`/journal), reutilizando
`accounting_accounts`, roles `accountant`/`contador_general`, helpers `auth_*` y `audit_logs`.
Los módulos **no se modifican**: los adaptadores leen sus tablas/eventos existentes.

## 4 decisiones bloqueantes para Juan (antes de C1)
1. **Catálogo único:** consolidar en `accounting_accounts` y deprecar/migrar `accounting_accounts_v2`.
2. **Terceros:** fuente única (`parties`) vs seguir consolidando por vista. (Ya en decisiones pendientes.)
3. **Cuenta bancaria autoritativa:** `bank_accounts` (operativa, con saldos) vs `company_bank_accounts` (fiscal/CLABE).
4. **`regimen_fiscal` a nivel empresa:** hoy no existe en `companies` (solo en `cfdi_clients`).

## Índice del paquete C0
1. `CONTACHECK_C0_AUDITORIA_REPOSITORIO.md` — inventario y método.
2. `CONTACHECK_C0_MAPA_MODULOS.md` — qué hace cada módulo y su madurez.
3. `CONTACHECK_C0_ENTIDADES_COMPARTIDAS.md` — tablas reutilizables y duplicaciones.
4. `CONTACHECK_C0_MOVIMIENTOS_CONTABILIZABLES.md` — qué evento confirma cada asiento.
5. `CONTACHECK_C0_BRECHAS_INTEGRACION.md` — huecos entre lo que hay y lo que la contabilidad exige.
6. `CONTACHECK_C0_CONTRATO_NORMALIZADO.md` — el shape canónico del movimiento.
7. `CONTACHECK_C0_ESTRATEGIA_ADAPTADORES.md` — cómo se conecta cada módulo sin tocarlo.
8. `CONTACHECK_C0_SEGURIDAD.md` — RLS, capacidades, cifrado, PII, auditoría.
9. `CONTACHECK_C0_ROADMAP.md` — fases C1→Cn con criterios de salida.

> **Estado:** paquete C0 completo. No se implementa nada. **Espera revisión.**
