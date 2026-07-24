# ContaCheck · C0 — Roadmap

> Fases de C1 en adelante, con criterios de entrada/salida. **Nada de esto se ejecuta en C0.** El arranque
> de C1 queda condicionado a la revisión de Juan y a las 4 decisiones bloqueantes.

## Prerrequisitos (gates antes de C1)
- [ ] **Decisión: catálogo único** `accounting_accounts` (+ migrar campos útiles de `_v2`, deprecar v2, arreglar FK de `expenses`). *(D2, bloqueante)*
- [ ] **Decisión: party master** `parties` vs vista de consolidación. *(D1, ya en pendientes de Juan)*
- [ ] **Decisión: cuenta bancaria autoritativa** (`bank_accounts` vs `company_bank_accounts`). *(D4)*
- [ ] **Decisión: `regimen_fiscal` en `companies`.** *(D3)*
- [ ] **Verificación de drift en prod** (objetos reales de cobra/bank/viaticos; X1/X2/X4).

## C1 — Fundamentos contables (esquema + contrato)
**Entrada:** decisiones bloqueantes resueltas.
**Trabajo:**
- Consolidar catálogo de cuentas (una sola tabla viva).
- Definir el **libro/journal unificado** de ContaCheck y `accounting_vouchers` como salida única.
- Formalizar el **contrato normalizado** (doc 6) como tipos compartidos (`packages/shared`).
- Añadir campos faltantes de datos donde correspondan (fecha contable, moneda, retenciones) — **de forma
  aditiva**, sin romper módulos.
- RLS + capacidades + auditoría de ContaCheck.
**Salida:** esquema contable unificado, con RLS y tests, sin adaptadores aún. Rollback probado.

## C2 — Motor de partida doble
**Trabajo:**
- Reglas por `event_type` → líneas debe/haber con **IVA y retenciones separadas** (P2) y **contrapartida
  configurable** (P1), reemplazando `generate_accounting_entries` (contrapartida fija).
- Invariante `Σdebe=Σhaber`; idempotencia; contra-asiento de cancelación (P9).
- Mapeo cuenta↔categoría **único en servidor** (reutiliza `accounting_category_map`, elimina el hardcode
  duplicado P8).
**Salida:** dado un `MovimientoContabilizable`, produce póliza balanceada persistida.

## C3 — Adaptador BancoCheck (plantilla + conciliación)
**Por qué primero:** ya clasifica a cuenta real y tiene VoBo. Trae la contrapartida bancaria → base de
conciliación. Persistir la póliza en `accounting_vouchers` (cierra P7).
**Salida:** movimientos bancarios contabilizados y conciliados end-to-end.

## C4 — Adaptador GastoCheck
Cablear el motor existente al evento real (`authorized`/`invoice_applied`/`closed_in_policy`), reconciliando
el modelo dual expenses/receipts para montos fiscales. Conectar el export real con los asientos (P5).

## C5 — Adaptador NóminaCheck
Contable desde el diseño (esquema limpio). Provisión al aprobar, pago al `paid_at`, **sin exponer PII**.
Requiere Fase 1B de NóminaCheck (UI) razonablemente avanzada.

## C6 — Adaptador CobraCheck
**Bloqueado hasta cerrar brechas de datos** (retenciones D5, moneda D6, nota de crédito D8, tipo CFDI D9).
Devengo de factura + cobro, IVA trasladado por cobrar → trasladado.

## C7 — Validación SAT real + cierre de período
- Sustituir `validate_cfdi_with_sat` simulada por verificación real antes de acreditar IVA (P4).
- Cierre mensual/anual de período con bloqueo de re-contabilización.

## C8 — Exportación y reportes contables
Unificar sobre `accounting_export_profiles` (CONTPAQi/Aspel/Microsip/Excel). Estados financieros básicos
(balanza, mayor, diario) desde el libro unificado.

## C9 — FlujoCheck como consumidor
FlujoCheck lee del libro real de ContaCheck (deja de depender de agregación frágil de tablas dispersas).

## Orden y dependencias
```
gates → C1 → C2 → C3(Banco) → C4(Gasto) → C5(Nómina) → C6(Cobra) → C7(SAT/cierre) → C8(export) → C9(Flujo)
                         └─ conciliación transversal desde C3 ─┘
```

## Criterios globales de calidad (todas las fases)
- Aditivo y no invasivo; rollback probado por fase.
- RLS + capacidades + auditoría inmutable.
- Verificar objetos reales en prod (no confiar en `schema_migrations`).
- Cero PII de nómina en el libro.
- Cada fase cierra con tests (SQL + HTTP) como F1A de NóminaCheck.

> **C0 termina aquí. No se inicia C1 ni ninguna implementación. Espera revisión de Juan.**
