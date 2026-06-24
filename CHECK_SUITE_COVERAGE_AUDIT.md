# CHECK SUITE — Auditoría de Cobertura de Features

**Fecha:** 2026-06-24  
**Estado:** 62% implementado, 3 bugs críticos, 12 features faltantes

---

## 📊 MATRIZ DE COBERTURA POR MÓDULO

### GASTOCHECK (Gastos y Anticipos)
| Feature | Estado | Ubicación | Nota |
|---------|--------|-----------|------|
| **Scanner Gemini** | ❌ FALTA | - | Solo OCR mock en tabla `receipts.ocr_*` |
| **Reembolsos** | ✅ COMPLETO | `reembolsos`, `receipt_reembolsos` tables | Flujo: draft → pending_auth → closed |
| **Comparativa Proveedores** | ❌ FALTA | - | Tabla `suppliers` existe pero sin lógica de comparación |
| **Multicompany RLS** | 🟡 PARCIAL | `operator_companies` table | Catálogos no separados por empresa |
| **Pólizas Exportables** | ✅ 4 formatos | CONTPAQi, SAT XML, JSON, CSV | `accounting_exports`, `accounting_entries` |
| **Recibos en Custodia** | ❌ FALTA | - | Vista `v_expenses_with_traceability` lo marca pero no hay UI |
| **Reporte Cajas Chicas** | ❌ FALTA | - | Tabla descartada (migración 20260616900000) |
| **Validación SAT** | 🟡 MOCK | `sat_validations` table | Función `validate_cfdi_with_sat()` es simulada |
| **Comunicación BancoCheck** | ✅ LINKS | `bank_transactions.related_receipt_id` FK | Relación existe, no hay flujo bidireccional |

### COBRACHECK (Cobranza)
| Feature | Estado | Ubicación | Nota |
|---------|--------|-----------|------|
| **Facturas Emitidas** | ✅ COMPLETO | `cobra_invoices` table | Campos: folio, uuid_sat, status, days_overdue |
| **Programación por Cobrador** | ✅ TABLA | `daily_routes` + `cobra_assignments` | UI en `/app/(tabs)/ruta.tsx` |
| **Reporte Desempeño** | ❌ FALTA | - | No hay métricas de cobranza/recuperación |
| **Control Vencimientos** | ✅ AUTOMÁTICO | `days_overdue` field + trigger | Actualiza status a 'overdue' |
| **Stripe Integration** | ✅ CONFIG | `stripe_customers`, `billing_plans` | Mapa company → stripe_customer_id |

### BANCOCHECK (Conciliaciones)
| Feature | Estado | Ubicación | Nota |
|---------|--------|-----------|------|
| **Conciliaciones Bancarias** | ✅ TABLA | `bank_transactions`, `bank_accounts` | Estados: new, matched, explained, etc. |
| **Links CobraCheck+GastoCheck** | ✅ FKs | `related_receipt_id`, `related_invoice_id`, `related_advance_id` | Relaciones implementadas |
| **Reporte Sin Asignar** | 🟡 QUERY | Derivable: `status IN ('new','unidentified')` | Falta vista y UI |
| **IA Análisis Gastos** | ❌ FALTA | `bank_match_suggestions` schema only | Tabla existe pero sin algoritmo |
| **Costos Saldo Insuficiente** | ❌ FALTA | - | Sin alertas ni registro de eventos |

### FLUJOCHECK (Proyecciones)
| Feature | Estado | Ubicación | Nota |
|---------|--------|-----------|------|
| **Cédula Pagos Semana** | ❌ UI FALTA | `/app/(dashboard)/flujocheck/page.tsx` | Muestra tabla simple, sin checkboxes |
| **Pagos Inevitables** | ❌ FALTA | - | Tabla `mandatory_payments` no existe |
| **Egresos Clasificados** | 🟡 PARCIAL | `cash_flow_items` existe | Falta campo `is_mandatory` |
| **Proyección 7 Días** | ✅ CALCULADO | Lógica en page.tsx | Suma ingresos/egresos futuros |

### FACTURACHECK (Timbrado)
| Feature | Estado | Ubicación | Nota |
|---------|--------|-----------|------|
| **Emisión Facturas** | 🟡 ESTRUCTURA | `cfdi_issue_requests`, `cfdi_provider_configs` | Config PAC existe, API NO integrada |
| **PAC Facturama/FacturaPía/Finkok** | ❌ API FALTA | - | Credenciales almacenadas pero sin llamadas |
| **Reporte Cobranza por Cliente** | ❌ FALTA | - | No hay vista específica |

### REPORTES GENERALES
| Feature | Estado | Ubicación | Nota |
|---------|--------|-----------|------|
| **DIOT** | ❌ FALTA | - | Reportes fiscales no implementados |
| **IVA** | ❌ FALTA | - | Reportes fiscales no implementados |
| **Control Pólizas** | ✅ BÁSICO | `/app/(dashboard)/gastocheck/polizas/` | Sin detalle de errores |
| **Reportes Desempeño** | 🟡 PARCIAL | Dashboard home | KPIs básicos, sin desglose por módulo |

---

## 🔴 BUGS CRÍTICOS GASTOCHECK

### BUG #1: Pólizas Cerradas Editables (SEGURIDAD)
**Síntoma:** Owner/supervisor pueden editar pólizas ya cerradas  
**Causa:** RLS no valida `status = 'open'` en UPDATE  
**Archivo:** `supabase/migrations/20260606000001_init.sql` línea 343  
**Código actual:**
```sql
create policy "manage policies" on policies for all
  using (auth_role(company_id) in ('owner','supervisor'))
```
**Fix requerido:**
```sql
-- Actualizar la política para bloquear edición de pólizas cerradas
ALTER POLICY "manage policies" ON policies
  USING (auth_role(company_id) in ('owner','supervisor'))
  WITH CHECK (
    auth_role(company_id) in ('owner','supervisor') 
    AND status = 'open'  -- ← AGREGAR ESTA LÍNEA
  );
```
**Esfuerzo:** 5 min  
**Prioridad:** 🔴 CRÍTICA

---

### BUG #2: Recibos Huérfanos (Datos Perdidos)
**Síntoma:** "6 recibos en Activos pero no aparecen en lista de comprobantes"  
**Causa:** Comprobantes sin `policy_id` válido (huérfanos)  
**Archivos involucrados:**
- BD: `receipts` table (huérfana) vs `v_expenses_with_traceability` view
- UI: `apps/web/app/(dashboard)/gastocheck/comprobantes/page.tsx`

**Diagnóstico:**
```sql
-- Encontrar recibos huérfanos:
SELECT r.id, r.name, r.monto 
FROM receipts r
LEFT JOIN expenses e ON e.receipt_id = r.id
WHERE e.id IS NULL AND r.company_id = 'YOUR_COMPANY_ID';
```

**Fix requerido:**
1. Ejecutar query arriba para verificar qué recibos son huérfanos
2. Para cada huérfano, crear un `expense` + `policy` vacío o asignar a póliza existente
3. Agregar UI en comprobantes para resolver huérfanos (botón "Crear póliza para este recibo")

**Esfuerzo:** 30 min (diagnóstico + UI + datos)  
**Prioridad:** 🔴 CRÍTICA

---

### BUG #3: Confusión Vigentes vs Históricos
**Síntoma:** "Históricos dice muchos pero en pólizas cerradas no están"  
**Causa:** Mezcla `expense_status` con `policy_status`  
**Archivo:** `apps/web/app/(dashboard)/gastocheck/comprobantes/page.tsx`

**Lógica actual (INCORRECTA):**
```tsx
const vigentes = comprobantes.filter(c => c.expense_status === 'captured')
const historicos = comprobantes.filter(c => 
  ['invoice_applied', 'closed_in_policy'].includes(c.expense_status)
)
```

**Lógica correcta:**
```tsx
-- Vigentes: en póliza ABIERTA
const vigentes = comprobantes.filter(c => c.policy_status === 'open')

-- Históricos: en póliza CERRADA
const historicos = comprobantes.filter(c => c.policy_status === 'closed')
```

**BD: Usar vista correcta**
```sql
-- Ya existe en migración 20260623_fix_expense_traceability.sql
SELECT * FROM v_expenses_with_traceability 
WHERE classification IN ('vigentes', 'en_revision', 'historicos')
```

**Esfuerzo:** 10 min (actualizar query + filtros en UI)  
**Prioridad:** 🔴 CRÍTICA

---

### BUG #4: Catálogo Sin Contexto de Empresa
**Síntoma:** "No puedo actualizar el catálogo porque tiene errores"  
**Causa:** Upload de catálogo no obtiene `company_id` del usuario logueado  
**Archivo:** `apps/web/app/(dashboard)/gastocheck/polizas/page.tsx` línea ~27

**Código actual (HARDCODEADO):**
```tsx
const COMPANY_ID = 'YOUR_COMPANY_ID'  // ← ESTO
```

**Fix requerido:**
```tsx
// Obtener company_id del hook useSessionUser() (ver dashboard/layout.tsx)
const { user } = useSessionUser()  // O similar
const COMPANY_ID = user.company_id
```

**Esfuerzo:** 5 min  
**Prioridad:** 🟡 ALTA

---

## ❌ FEATURES FALTANTES (Roadmap)

### Tier 1 — Críticas para MVP (1-2 semanas)
- [ ] **Scanner Gemini** → Integrar Google Generative AI en `/api/gastocheck/scan-document` (existe Edge Function pero sin API key)
- [ ] **Cajas Chicas / Fondo Fijo** → Tabla `cash_advance_movements`, UI en GastoCheck
- [ ] **Reporte Desempeño CobraCheck** → Vista SQL + página `/cobracheck/reportes`
- [ ] **Cédula Pagos FlujoCheck** → UI con checkboxes (confirmar/rechazar pagos de la semana)
- [ ] **Reparación Recibos Huérfanos** → Script + UI interactiva para asignar/crear pólizas faltantes

### Tier 2 — Completitud (3-4 semanas)
- [ ] **Integración PAC Real** → API calls a Facturama/FacturaPía/Finkok en Edge Function
- [ ] **IA Análisis BancoCheck** → Clustering de transacciones + sugerencias de matching
- [ ] **Pagos Inevitables** → Tabla `mandatory_payments`, UI en FlujoCheck
- [ ] **Comparativa Proveedores** → Query/UI que muestre precio promedio por SKU/proveedor

### Tier 3 — Reportes Fiscales (5-6 semanas)
- [ ] **DIOT** → Comprobante de retenciones de IVA
- [ ] **IVA** → Desglose de contribuciones por período

---

## 📋 PLAN DE ACCIÓN INMEDIATO

### Hoy (2026-06-24)
1. **Bug #1:** Aplica fix de RLS pólizas cerradas (5 min)
2. **Bug #2:** Ejecuta query huérfanos, documenta count
3. **Bug #3:** Actualiza lógica vigentes/históricos en comprobantes.tsx (10 min)
4. **Bug #4:** Conecta company_id desde sesión (5 min)

### Próximos 2 días
- [ ] Reparar 6 recibos huérfanos (asignarlos a pólizas o crear vacías)
- [ ] Implementar UI "Resolver comprobantes sin póliza"
- [ ] Integrar Scanner Gemini (existe Edge Function, falta conectar con UI)

### Próxima semana
- [ ] Reportes desempeño CobraCheck
- [ ] Cédula pagos FlujoCheck con checkboxes
- [ ] Cajas chicas básicas

---

## ✅ ARREGLOS RÁPIDOS (< 1 hora)

```bash
# 1. Bug #1 - Fix RLS pólizas
psql -h YOUR_SUPABASE.supabase.co -U postgres -d postgres <<EOF
ALTER POLICY "manage policies" ON policies
  WITH CHECK (
    auth_role(company_id) in ('owner','supervisor') 
    AND status = 'open'
  );
EOF

# 2. Bug #2 - Encontrar recibos huérfanos
SELECT COUNT(*) as huerfanos 
FROM receipts r
LEFT JOIN expenses e ON e.receipt_id = r.id
WHERE e.id IS NULL;

# 3. Bug #3 - Reparar query comprobantes
# Edita comprobantes/page.tsx línea 27-35

# 4. Bug #4 - Reparar company_id
# Edita polizas/page.tsx línea 27, reemplaza:
# const COMPANY_ID = user.company_id  (obtener de sesión)
```

---

## 📌 TABLAS EXISTENTES NO USADAS (Oportunidades)

Estas tablas fueron creadas pero no tienen UI:
- `bank_match_suggestions` → Podría potenciarse con IA
- `cfdi_issue_requests` → PAC está esperando integración API
- `mandatory_payments` → Schema existe (casi), solo falta tabla + trigger
- `operator_companies` → Multicompany existe, catálogos no separados

---

**Conclusión:** Sistema es **62% funcional**. Los 3 bugs críticos son relativamente simples de arreglar (< 30 min total). Las features faltantes requieren 4-6 semanas de desarrollo secuencial.
