# ContaCheck · C1.1 — Motor Central de Reglas Contables

> Motor consultado por todos los módulos para resolver cuentas/contrapartidas/impuestos. Las cuentas dejan de
> vivir en el código. Diseño, sin implementación. Ref. §8, §9, §10.

## 1. Problema que resuelve (evidencia)
Hoy las cuentas están **hardcodeadas en el cliente**, duplicadas y divergentes:
- `apps/web/lib/poliza.ts:140-156` (`CATEGORY_ACCOUNT`, `1010`, `1180`, `1500`, `6100`…).
- `apps/mobile/app/bancocheck/poliza-dia.tsx:17-31` (mapa equivalente, **duplicado**).
- `apps/mobile/app/facturacheck/hooks/useFacturaCheck.ts:407-416` (`4000`, `2108`, `1200`).
- `20260623000001:209` (contrapartida `1010` fija en el motor SQL roto).
Además existe `accounting_category_map` (`20260608000003:342-356`: categoría→`accounting_account`/`tax_account`/
`counterpart_account` como **TEXT**, sin FK) — un mapeo parcial ya presente, a **reutilizar** como base.

## 2. Diseño del motor (conceptual)
Entrada: un `MovimientoContabilizable` (contrato). Salida: conjunto de líneas debe/haber balanceadas.
Regla = condición → asignación de cuentas/impuestos, con prioridad y vigencia.

**Dimensiones de condición (todas opcionales):** empresa, módulo, `event_type`, categoría
(`expenses.category_id`, `expense_categories.acct_code`), proveedor/cliente/empleado (por `party_id`/tipo),
producto, almacén (`inventory_locations`), sucursal/`branch`, centro de costo (`cost_centers`), proyecto
(tag/cost_center), tratamiento fiscal (`is_deductible`, `requires_cfdi` — de v2 a portar), forma de pago
(`cfdi_data.forma_pago`), moneda.

**Atributos de la regla:** `priority` (numérica), `specificity` (nº de condiciones no nulas, desempata),
`valid_from`/`valid_to` (vigencia), `version`, `published` (borrador vs publicada), `is_default` (regla por
defecto por `event_type`).

## 3. Resolución (algoritmo conceptual)
1. Filtrar reglas de la empresa vigentes a `accounting_date` y `published`.
2. Que casen las condiciones del movimiento.
3. Ordenar por `specificity` desc, luego `priority` desc.
4. Si **1 gana** → aplica. Si **empate de especificidad+prioridad** → **excepción "regla ambigua"** →
   `CONFIGURATION_REQUIRED` (no adivinar).
5. Si **ninguna** casa → `is_default` del `event_type`; si tampoco → **"regla ausente"** →
   `CONFIGURATION_REQUIRED`.
6. Si la cuenta resuelta está **inactiva** (`accounting_accounts.active=false`) → excepción.

## 4. Simulación, publicación, versión, rollback
- **Simulación:** aplicar reglas a movimientos históricos sin persistir póliza (dry-run) → detectar huecos
  antes de publicar.
- **Publicación:** una versión de reglas se publica atómicamente; las pólizas guardan `rule_version` usada.
- **Rollback de versiones:** volver a una versión previa publicada (las pólizas ya `posted` no cambian:
  inmutables; solo futuras usan la nueva versión).
- **Auditoría:** cada cambio de regla en `audit_logs` (`entity_type='contacheck_rule'`).

## 5. Revisión de `poliza.ts` (§9) — veredicto por función/regla

| Elemento (evidencia) | Veredicto |
|---|---|
| `validatePoliza` / validación `debe=haber` (`poliza.ts:92-101,109-121`) | **SE_CONSERVA_COMO_REQUERIMIENTO** (invariante del motor) |
| `splitBankFeeIVA` (IVA 16% acreditable) (`poliza.ts:164-168`) | **SE_EXTRAE_Y_CORRIGE** (a regla fiscal parametrizada por tasa) |
| `generatePolizaFromBankMatches` líneas Banco+contraparte (`poliza.ts:177-259`) | **SE_EXTRAE_Y_CORRIGE** (reglas al motor; cuentas del catálogo) |
| `CATEGORY_ACCOUNT` hardcodeado (`poliza.ts:140-152`) | **SE_REEMPLAZA** (por `accounting_category_map` + reglas) |
| `generatePolizaFromPayment` clasificación ingreso/egreso (`poliza.ts:43-104`) | **SE_EXTRAE_Y_CORRIGE** — **bug de signo**: cobro de cliente marcado `EGRESO` con Banco al HABER (`:52,62-68`); debe ser INGRESO, Banco al DEBE, Clientes al HABER |
| Cuentas de banco `1010` / cliente `1500` / IVA `1180` (`poliza.ts:48-49,154-155`) | **SE_REEMPLAZA** (catálogo/motor) |
| `formatDateForPoliza`/`formatMoney` (`poliza.ts:264-277`) | **SE_CONSERVA** (util de formato) |
| Numeración `BC-…Date.now()` (`poliza.ts:186`) | **SE_REEMPLAZA** (folio por empresa/período) |

**Pruebas de regresión antes de retirar la lógica cliente:** fijar casos-oro con las cuentas y signos
**correctos** (cobro=INGRESO; gasto=EGRESO; comisión bancaria con split IVA; transferencia interna sin
resultado) para garantizar que el motor reproduce la intención — corrigiendo el signo, no copiándolo.

## 6. Motor SQL roto (§10) — congelamiento y retiro
- `generate_accounting_entries` (`20260623000001:157-221`): **invocado desde 0 lugares** (grep en `apps/`+
  `functions/` = 0). **Datos generados: ninguno** (no hay caller). → **puede desactivarse sin impacto.**
- **Comportamiento a rescatar:** la *intención* (asiento por gasto autorizado con contrapartida) — se
  reimplementa en el motor nuevo leyendo **v1** con contrapartida configurable.
- **Comportamiento a NO trasladar:** JOIN a v2 (`:180`), contrapartida `1010` fija (`:209`), asiento de una
  sola línea sin IVA/retención, `validate_cfdi_with_sat` simulada (`:112-154`).
- **Proceso:** marcar legado en C1.1 → congelar (ningún objeto nuevo lo llama) → retirar en la fase final
  junto con `accounting_entries` y `export_policy_*`, tras confirmar 0 dependencias y 0 filas en prod. **No se
  repara.**
