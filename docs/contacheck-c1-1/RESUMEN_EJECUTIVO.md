# ContaCheck · C1.1 — Resumen Ejecutivo

> Diseño ejecutable de generación automática e integración por módulo. Solo lectura: sin migraciones, sin
> cambios de código, sin producción. Ref. §1–§20.

## 1. Principio
Cada módulo operativo **genera automáticamente** la propuesta de póliza de sus operaciones (vía su generador +
resolución de reglas + contrato normalizado). ContaCheck **administra catálogo y reglas, recibe, valida,
controla idempotencia, revisa/aprueba, contabiliza, consolida y produce el libro**. Los módulos **no** insertan
movimientos definitivos en el mayor.

```
Operación confirmada → Generador del módulo → Reglas → Póliza normalizada
→ Validación ContaCheck → proposed/posted → Libro contable
```

## 2. Hallazgos que definen C1.1 (evidencia)
1. **`accounting_vouchers` ya se escribe hoy** por 2 rutas (`bancocheck/conciliacion/page.tsx:187`,
   `facturacheck/hooks/useFacturaCheck.ts:423`) — corrige a C0. La infraestructura de póliza **ya vive**.
2. **Cuentas hardcodeadas en el cliente**, duplicadas (`poliza.ts:140-156`, `poliza-dia.tsx:17-31`,
   `useFacturaCheck.ts:407-416`) → el motor de reglas las centraliza.
3. **Motor SQL `generate_accounting_entries` roto y sin caller** (`20260623000001:157-221`) → se congela, no se
   reutiliza.
4. **Estados contables no existen** en ningún módulo (`accounting_ready`/`voucher_generated`/`posted`) → los
   aporta ContaCheck en `accounting_vouchers`, sin tocar los módulos.
5. **`accounting_source_links` e `idempotency_key` son greenfield**; `voucher_number` es UNIQUE **global**
   (riesgo multi-tenant, `20260705130000:70`).
6. **Madurez para contabilidad:** NóminaCheck es el más fuerte (aprobación con segregación de funciones,
   optimistic lock `version`, `suggested_account_debit/credit`, retenciones con `account_code`); CobraCheck el
   más débil (sin retenciones/moneda/nota de crédito, comisión 3% hardcodeada, sin reversa de pago).

## 3. Piloto (ratificado)
- **Técnico = BancoCheck:** ya persiste póliza + ya tiene VoBo; valida contrato/persistencia/conciliación/
  idempotencia/reversa. Rol: **conciliar, no originar**.
- **Funcional = GastoCheck:** dispara en `authorized`; reconoce gasto, CxP, pago (vía `accounts_payable`),
  anticipo, reversa. Reto: montos triplicados y retenciones solo en `receipts`.

## 4. Estado de resolución de los ítems del gate (§20)
| Ítem | Estado | Documento |
|---|---|---|
| Contrato normalizado | ✅ diseñado | `CONTRATO_NORMALIZADO_POLIZA.md` |
| Estructura de póliza | ✅ (ampliación aditiva de `accounting_vouchers`) | idem |
| Estados / ciclo | ✅ `generated→validated→pending_configuration→pending_review→approved→posted→rejected→reversed` | idem + Idempotencia |
| Líneas | ✅ `accounting_voucher_lines` | Contrato §2 |
| Idempotencia | ✅ llave por empresa | `IDEMPOTENCIA_Y_REVERSAS.md` |
| Reversas | ✅ contra-asiento, período cerrado | idem |
| Reglas | ✅ motor central (prioridad/especificidad/vigencia/simulación/rollback) | `MOTOR_REGLAS_CONTABLES.md` |
| BancoCheck | ✅ piloto técnico | `BANCOCHECK_PILOTO_TECNICO.md` |
| GastoCheck | ✅ piloto funcional | `GASTOCHECK_PILOTO_FUNCIONAL.md` |
| Parties | ✅ vinculación por rol + casos límite | `PARTIES_FISCAL_DIMENSIONES.md` |
| Perfil fiscal | ✅ snapshot del perfil vigente | idem |
| Dimensiones | ✅ por línea, por referencia | idem |
| Pruebas | ✅ 17 pruebas | `PLAN_IMPLEMENTACION.md §18` |
| Secuencia | ✅ 6 etapas | idem §17 |
| Rollback conceptual | ✅ aditivo/flag; legado al final | idem |

## 5. Ciclo de estados de la póliza (§7)
```
generated → validated → pending_configuration   (regla/cuenta/dimensión ausente)
                     → pending_review            (importe extraordinario, IA baja confianza)
                     → approved → posted          (inmutable)
                     → rejected
posted → reversed (por contra-asiento; nunca edición/borrado)
```
Mapeo a lo existente: `accounting_vouchers.status` hoy es `draft/exported/reconciled` (`20260705130000:86`) →
se amplía sin duplicar (draft≈generated; se añaden los faltantes).

## 6. Precondiciones antes de escribir migraciones (no bloquean el diseño)
- Verificación de objetos reales en prod (§ gate).
- CobraCheck (Etapa 4) e Inventarios (Etapa 6) requieren **añadir datos** primero (retenciones/moneda/nota de
  crédito; valuación/COGS) — son etapas posteriores, no de los pilotos.

## 7. VEREDICTO (§20)

```
C1.1 LISTO PARA DISEÑO DE MIGRACIONES
```

**Justificación:** los 15 ítems del gate están **diseñados con evidencia `archivo:línea`** (contrato,
estructura, estados, líneas, idempotencia, reversas, reglas, BancoCheck, GastoCheck, parties, perfil fiscal,
dimensiones, pruebas, secuencia, rollback). El diseño es **no destructivo** (aditivo/flag; el legado se retira
solo al final con evidencia de 0 dependencias). Las precondiciones pendientes (verificación de drift en prod;
adición de datos para CobraCheck/Inventarios) corresponden a **etapas posteriores a los pilotos** y no
bloquean el diseño de las migraciones de la infraestructura mínima ni de los dos pilotos.

## Paquete C1.1 (10 documentos en `docs/contacheck-c1-1/`)
`GENERADORES_EXISTENTES` · `MATRIZ_OPERACIONES_CONTABILIZABLES` · `GASTOCHECK_PILOTO_FUNCIONAL` ·
`BANCOCHECK_PILOTO_TECNICO` · `CONTRATO_NORMALIZADO_POLIZA` · `MOTOR_REGLAS_CONTABLES` ·
`IDEMPOTENCIA_Y_REVERSAS` · `PARTIES_FISCAL_DIMENSIONES` · `PLAN_IMPLEMENTACION` · `RESUMEN_EJECUTIVO`.

> **No se escribieron migraciones ni se modificó código. No se inicia C2. Detente y espera revisión.**
