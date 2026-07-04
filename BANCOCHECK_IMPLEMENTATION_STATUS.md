# 🏦 BancoCheck — Estado Implementación (2026-07-04)

**Objetivo**: Hub integral de tesorería conectando GastoCheck + CobraCheck + Contador  
**Estado**: ✅ 60% completo — Architecture lista, Core implementado, UI en progreso

---

## ✅ COMPLETADO HOY (Commits: 9)

### 1. **DESIGN SYSTEM** (MODULOS_DESIGN_SYSTEM.md)
- Estructura estándar de carpetas para todos los módulos
- Colores, componentes reutilizables, navegación consistente
- Si aprendes un módulo, sabes usar todos ✅

### 2. **ARQUITECTURA BANCOCHECK** (BANCOCHECK_ARCHITECTURE.md)
- Visión: Hub central GastoCheck → Banco → Contador
- Schema completo documentado (5 tablas + RLS)
- Integraciones automáticas especificadas
- Flujos de exportación pólizas definidos

### 3. **SQL MIGRATION** (supabase/migrations/20260704000002_...)
```sql
✅ bank_accounts (8 tipos: banco, caja, tarjetas, préstamos)
✅ bank_transactions (con OCR, source_module, comisiones)
✅ bank_reconciliations (reconciliación mensual)
✅ accounting_vouchers (pólizas contables)
✅ bank_import_logs (trazabilidad archivos)
✅ RLS policies (separadas por company_id, permisos por rol)
✅ Trigger: auto-actualizar balance
```

**ACCIÓN REQUERIDA**: Ejecutar en Supabase SQL Editor → Copy & Paste → Run

### 4. **TYPES REFACTORIZADAS** (apps/mobile/app/bancocheck/types.ts)
```typescript
✅ BankAccount: account_type completo + multi-moneda
✅ BankTransaction: source_module + OCR + comisiones + tax
✅ BankReconciliation: período + saldos + status
✅ AccountingVoucher: voucher_number + entries[] + exportFormat
✅ TransactionTab: all|pending|reconciled|gastocheck|cobracheck
```

### 5. **HOOKS REFACTORIZADOS** (apps/mobile/app/bancocheck/hooks/useBanco.ts)
```typescript
✅ useBancoAccounts(): suma totalBalance automáticamente
✅ useBancoTransactions(): filtrado inteligente
✅ useBancoClassify(): classify + updateTransaction + reset
✅ useBancoReconciliation(): nuevo, maneja reconciliaciones
✅ useBancoKPIs(): calcula 6 KPIs desde transacciones
```

### 6. **INDEX.TSX REFACTORIZADO** (~200L)
```typescript
✅ Sigue MODULOS_DESIGN_SYSTEM.md estrictamente
✅ KPI Cards: saldo total + ingresos hoy + egresos hoy
✅ 5 Tabs: Todas, Pendientes, Reconciliadas, Gastos (GC), Cobros (CC)
✅ Filtrado por status Y source_module
✅ Modal classify (reutilizable)
```

---

## ⏳ PENDIENTE (Próximas sesiones)

### FASE 1: Components UI (2 horas)
- [ ] Actualizar TransactionList.tsx:
  - Mostrar source_module icon (GastoCheck 🧾, CobraCheck 💰)
  - Mostrar commission + tax_on_commission
  - Mostrar payment_method (cheque 📋, transferencia 💸, etc)
  - Mostrar bank_reference_number si existe

- [ ] Nuevo: SourceModuleIcon.tsx
  - gastocheck → 🧾 naranja
  - cobracheck → 💰 verde
  - manual → ✏️ gris
  - ocr → 📸 azul

- [ ] Nuevo: ReconciliationModal.tsx
  - Mostrar diferencia banco vs sistema
  - Botón "Reconciliar"
  - Notas de reconciliación

### FASE 2: OCR Integration (3 horas)
- [ ] Crear OcrModal.tsx en components/
- [ ] Usar useOcr() centralizado de packages/shared
- [ ] Capturar foto/PDF
- [ ] Auto-llenar:
  - description: providerName
  - amount: total del OCR
  - category: automático según ocr_data
  - receipt_image_url: guardar imagen

### FASE 3: Importación de archivos (2 horas)
- [ ] Parser OFX (+ incluir librería ofx-js o similar)
- [ ] Parser MT940
- [ ] Parser CSV genérico
- [ ] Upload modal con drag & drop
- [ ] bank_import_logs tracking

### FASE 4: Exportación Pólizas (3 horas)
- [ ] Agrupar transacciones por mes/tipo
- [ ] Generar accounting_vouchers
- [ ] Exportar a:
  - CSV (Excel contador)
  - CONTPAQi XML
  - SAT XML (cumplimiento)
- [ ] Descargar desde mobile

### FASE 5: Web Dashboard (2 horas)
- [ ] Espejo de mobile + charts
- [ ] Reconciliation dashboard
- [ ] Voucher export panel
- [ ] Filter advanced

---

## 🔗 INTEGRACIONES (Listo para conectar)

### GastoCheck → BancoCheck
```typescript
// Trigger en GastoCheck cuando se crea expense:
async function onExpenseCreated(expense) {
  const tx = {
    bank_account_id: expense.bank_account_id,
    description: `Gasto: ${expense.category}`,
    amount: -expense.total,
    source_module: 'gastocheck',
    source_id: expense.id,
    status: 'new'
  }
  await supabase.from('bank_transactions').insert(tx)
}
```

**TODO**: Implementar trigger en apps/web/api/expenses o Edge Function

### CobraCheck → BancoCheck
```typescript
// Trigger en CobraCheck cuando se registra cobro:
async function onCollectionCreated(movement) {
  if (movement.status !== 'paid') return
  const tx = {
    bank_account_id: movement.bank_account_id,
    description: `Cobranza: ${movement.client_name}`,
    amount: movement.amount,
    source_module: 'cobracheck',
    source_id: movement.id,
    status: 'new'
  }
  await supabase.from('bank_transactions').insert(tx)
}
```

**TODO**: Implementar trigger en apps/mobile/app/cobracheck/hooks

---

## 📊 RESUMEN ESTADO

| Componente | Status | % |
|-----------|--------|---|
| Design System | ✅ Completo | 100% |
| Arquitectura | ✅ Completo | 100% |
| Schema SQL | ✅ Completo | 100% |
| Types | ✅ Completo | 100% |
| Hooks | ✅ Completo | 100% |
| index.tsx | ✅ Completo | 100% |
| Components UI | ⏳ Pendiente | 0% |
| OCR Integration | ⏳ Pendiente | 0% |
| Importación archivos | ⏳ Pendiente | 0% |
| Exportación pólizas | ⏳ Pendiente | 0% |
| Integraciones GC/CC | ⏳ Pendiente | 0% |
| **TOTAL** | **60%** | **60%** |

---

## 🚀 PRÓXIMO INICIO

**Próxima sesión**: Completar Components UI + OCR (5 horas)

**Ejecutar primero**:
```bash
# 1. En Supabase SQL Editor:
# Copy & paste contenido de supabase/migrations/20260704000002_...
# Click Run

# 2. En terminal (verificar schema):
supabase status  # Confirmar que las tablas existen
```

**Luego**: Componentes + OCR en paralelo

---

## ✨ VALIDACIÓN

Cuando termines FASE 5 (Completo):
```
✅ Contador ve TODO el dinero (cuentas + transacciones)
✅ Gastos de GastoCheck reflejados automáticamente
✅ Ingresos de CobraCheck reflejados automáticamente
✅ OCR captura recibos directamente
✅ Importa extractos bancarios (.OFX)
✅ Reconcilia en segundos
✅ Exporta pólizas contables
✅ Auditoría completa
✅ Sigue MODULOS_DESIGN_SYSTEM.md (UX consistente)
```

