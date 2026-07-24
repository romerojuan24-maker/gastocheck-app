# ContaCheck · C1 — Resumen Ejecutivo

> Diseño de consolidación sobre la infraestructura existente. Solo lectura: sin migraciones, sin cambios de
> código, sin aplicar a producción. Incluye núcleo evolutivo (§12), piloto (§13) y veredicto (§17).

## 1. Tesis
ContaCheck se construye **ampliando y conectando** lo que ya existe. No hay segunda arquitectura contable.
Las 7 autoridades quedan resueltas con evidencia; el trabajo es aditivo y reversible.

## 2. Decisiones (ADRs — detalle en `CONTACHECK_C1_DECISIONES_ARQUITECTONICAS.md`)
| ADR | Decisión | Estado |
|---|---|---|
| 001 | Catálogo autoritativo = `accounting_accounts` (v1) | **Aceptado** |
| 002 | Congelar v2 + portar sus columnas fiscales a v1 | Propuesto |
| 003 | GastoCheck: vista de cuenta normalizada (no invasiva) | Propuesto |
| 004 | Reutilizar reglas de `poliza.ts`; reemplazar motor SQL roto | Propuesto |
| 005 | `accounting_vouchers` = póliza definitiva (ampliar) | Propuesto |
| 006 | Terceros = `parties` + `party_links` (no invasivo) | Propuesto (ratif. Juan) |
| 007 | Bancos = `bank_accounts` (op/contable) + `company_bank_accounts` (fiscal) + puente | **Aceptado** |
| 008 | `company_tax_profiles` versionado | Propuesto |
| 009 | Integración por adaptadores por evento | **Aceptado** |
| 010 | Piloto = BancoCheck | Propuesto |

## 3. Correcciones a C0 (verificadas contra código)
1. **`expenses` tiene UNA sola FK, a v1**, no dos en conflicto: el intento a v2 (`20260623000001:62`) es
   **no-op** (`ADD COLUMN IF NOT EXISTS` sobre columna ya creada en `20260615300000:11`).
2. **El motor SQL está estructuralmente roto**, no solo "sin cablear":
   `generate_accounting_entries:180` une `expenses.accounting_account_id` (ids v1) contra `accounting_accounts_v2`
   → NULL → `INSERT` NOT NULL falla (`:79`).
3. **`poliza.ts` es librería TS pura de cliente** (sirve a CobraCheck **y** BancoCheck; no persiste), con un
   **bug de signo** en `generatePolizaFromPayment` (cobro marcado `EGRESO`/Banco al HABER, `:52,62-68`).
4. **v2 tiene 0 consumidores de app** y **cada catálogo tiene info exclusiva** (v1: jerarquía; v2: semántica
   fiscal) → consolidación = v1 + absorber columnas de v2, no "elegir uno y borrar".
5. **Bancos: complementarias, no duplicadas** (autoridad por campo resuelta).

## 4. Núcleo contable evolutivo (§12)
| Componente | Estado |
|---|---|
| Catálogo de cuentas | **YA EXISTE Y SE AMPLÍA** (`accounting_accounts` v1 + cols fiscales) |
| Pólizas (encabezado) | **YA EXISTE Y SE AMPLÍA** (`accounting_vouchers`) |
| Líneas | **SE CREA NUEVO** (`accounting_voucher_lines`, FK a v1) |
| Registros contabilizables (staging) | **SE CREA NUEVO** (contrato normalizado) |
| Reglas de contabilización | **SE CREA NUEVO** (config; reglas base extraídas de `poliza.ts`) |
| Períodos / cierres | **SE CREA NUEVO** |
| Dimensiones | **YA EXISTE Y SE AMPLÍA** (`cost_centers` `init:115` + dims) |
| Documentos | **YA EXISTE Y SE REUTILIZA** (`cfdi_documents`, `receipts`) |
| Terceros | **SE CREA NUEVO** (`parties`/`party_links`) reutilizando tablas op |
| Reversas / aprobaciones | **SE AMPLÍA** en `accounting_vouchers` |
| Auditoría | **YA EXISTE Y SE REUTILIZA** (`audit_logs`) |
| Motor de asientos SQL v2 | **SE DEPRECA** |

## 5. Piloto (§13) — matriz ponderada

| Criterio (peso) | BancoCheck | GastoCheck | NóminaCheck |
|---|---|---|---|
| Datos ya clasificados a cuenta v1 (25%) | **5** (`20260721100000:15`) | 3 (FK v1 pero motor roto) | 1 (sin clasificación aún) |
| VoBo del contador existente (20%) | **5** (`bancocheck_approve_suggestion`) | 2 | 2 (capacidades sí, flujo no) |
| Contrapartida bancaria / conciliación (20%) | **5** (es bancos) | 2 | 2 |
| Calidad/limpieza del esquema (15%) | 4 | 2 (modelo dual expenses/receipts) | **5** (nuevo, limpio) |
| Riesgo de tocar el módulo (10%) | **5** (adaptador por evento existente) | 3 | 4 |
| Madurez de UI/uso real (10%) | **5** | 4 | 1 (sin UI hasta 1B) |
| **Ponderado** | **≈4.85** | ≈2.6 | ≈2.2 |

**Recomendación:** **BancoCheck** como primer piloto. No se altera el módulo (el adaptador se engancha al
evento `bancocheck_approve_suggestion` ya existente); produce pólizas `proposed` en `accounting_vouchers` y
valida la conciliación. NóminaCheck es el mejor candidato a "contable desde el diseño" pero depende de Fase 1B
(UI). GastoCheck exige primero arreglar el motor roto y el modelo dual.

## 6. Decisiones que requieren ratificación de Juan (antes de implementar)
1. **`parties` + `party_links` ahora** (ADR-006) vs seguir consolidando por vista. *(Recom.: parties, ya lo
   favorecías; alta por Constancia + OCR.)*
2. **`company_tax_profiles` versionado** (ADR-008) vs solo añadir `regimen_fiscal` a `companies`. *(Recom.:
   versionado.)*
3. **Portar columnas fiscales de v2 a v1 y congelar v2** (ADR-002). *(Recom.: sí.)*
4. **Cuenta bancaria principal** (`is_primary`, no existe hoy) y **puente** `receipts`↔movimientos (ADR-007).
5. **Piloto = BancoCheck** (ADR-010).

## 7. Verificaciones de producción previas (drift)
Confirmar en prod objetos reales (no `schema_migrations`): filas en `accounting_accounts_v2`; existencia de
`cobra_collections`/`cobra_commissions` (migración revertida `20260708000001:1-10`); FK de `expenses` a v1;
`accounting_vouchers` con esquema `20260705130000`.

## 8. VEREDICTO (§17)

```
C1 LISTO CON DECISIONES PENDIENTES
```

**Justificación:** las 7 autoridades técnicas están **resueltas con evidencia** y el plan es **no
destructivo** (aditivo/reversible). No se emite "LISTO PARA IMPLEMENTACIÓN NO DESTRUCTIVA" porque restan (a)
**ratificaciones de negocio de Juan** (§6: parties, perfil fiscal versionado, congelamiento de v2, cuenta
principal, piloto) y (b) **verificaciones de objetos reales en producción** (§7) que condicionan el mapeo/retiro.
No es "BLOQUEADO": no hay inconsistencia sin salida; cada punto tiene decisión recomendada con evidencia.

## Paquete C1 (10 documentos en `docs/contacheck-c1/`)
1. `CONTACHECK_C1_DECISIONES_ARQUITECTONICAS.md`
2. `CONTACHECK_C1_CATALOGO_CONTABLE.md`
3. `CONTACHECK_C1_AUDITORIA_POLIZAS.md`
4. `CONTACHECK_C1_TERCEROS.md`
5. `CONTACHECK_C1_CUENTAS_BANCARIAS.md`
6. `CONTACHECK_C1_PERFIL_FISCAL.md`
7. `CONTACHECK_C1_AUTORIDAD_DATOS.md`
8. `CONTACHECK_C1_COMPATIBILIDAD.md`
9. `CONTACHECK_C1_PLAN_TRANSICION.md`
10. `CONTACHECK_C1_RESUMEN_EJECUTIVO.md`

> **No se escribieron migraciones ni se modificó código. No se inicia C2. Detente y espera revisión.**
