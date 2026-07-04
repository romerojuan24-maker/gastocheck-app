# 📋 ADR — Architectural Decision Records para SAT/Fiscal

**Objetivo**: Documentar decisiones de implementación fiscal para que no se replantee cada sprint  
**Status**: BAJO REVISIÓN (esperando auditoría completa)  
**Responsable**: Juan + Contador

---

## ADR-1: Selección de PAC para Timbre Digital

### CONTEXTO
- CHECK SUITE genera CFDIs (Comprobantes Fiscales Digital por Internet)
- Toda CFDI válida necesita **timbre digital** de un PAC (Proveedor Autorizado de Certificación)
- Opciones: Facturama, Facturapia, Finkok, SOLUCIONES, Quadrum, etc.

### DECISIÓN
**Recomendación**: **FINANZAUTO** (SOLUCIONES)

**Razón**: 
- Menor costo (~$1,500-2,000 MXN/mes)
- API simple (timbre en 200ms típico)
- Auto-retries en caso de error SAT
- Soporte técnico mexicano disponible

**Alternativas evaluadas**:
- Facturama: $3,000/mes, pero UI amigable
- Finkok: $2,000/mes, API vieja (SOAP)
- Quadrum: $2,500/mes, más lento

### IMPLEMENTACIÓN
```
1. Contratar con FINANZAUTO (contacto: ventas@finanzauto.com)
2. Obtener credenciales API
3. Crear Edge Function: supabase/functions/stamp_cfdi
4. Integrar en FacturaCheck create/issue flow
5. Validar: UUID devuelto + XML firmado
```

### ESTADO
- [ ] Contratado
- [ ] Credenciales obtenidas
- [ ] Edge Function implementada
- [ ] Integrado en web + mobile
- [ ] Tests passou

---

## ADR-2: RFC Validation Strategy

### CONTEXTO
- Facturas a RFC inválido/cancelado/fantasma → fraude fiscal
- SAT valida en auditoría → multa de $50k-500k si no se filtró

### DECISIÓN
**Opción A**: SAT API estándar (GRATUITO, lento)
- Consulta el padrón de SAT
- ~2-3 segundos por RFC
- Limitado: 1000 queries/día
- Usar: al crear empresa + supplier + customer

**Opción B**: PAC includes RFC check (RÁPIDO, incluido en timbre)
- PAC verifica RFC antes de timbrar
- ~100ms
- Ilimitado
- Pero: no valida proveedores, solo RFC estructura

**SELECCIÓN**: Opción A + Opción B (híbrido)
- Validación RFC en création: SAT API
- Validación RFC en timbre: PAC (como backup)
- Cache local 7 días (no abrumar SAT)

### IMPLEMENTACIÓN
```typescript
// packages/shared/src/validation/rfc-validator.ts
export async function validateRfcWithSat(rfc: string): Promise<{
  valid: boolean
  active: boolean
  razonSocial?: string
  error?: string
}> {
  // 1. Validar formato
  if (!isValidRfcFormat(rfc)) return { valid: false }
  
  // 2. Consultar cache local (7 días)
  const cached = await getRfcCache(rfc)
  if (cached && Date.now() - cached.checked_at < 7*24*3600*1000) {
    return cached
  }
  
  // 3. Consultar SAT API
  try {
    const result = await satApi.validateRfc(rfc)
    await setRfcCache(rfc, result)
    return result
  } catch (err) {
    // Si SAT está caído, permitir pero marcar con ⚠️
    return { valid: true, active: null, error: 'SAT unavailable' }
  }
}
```

### ESTADO
- [ ] Implementar validador RFC
- [ ] Integrar en create_company
- [ ] Integrar en add_supplier
- [ ] Integrar en add_customer
- [ ] Tests: RFC válido, inválido, cancelado

---

## ADR-3: Pólizas Contables Automáticas

### CONTEXTO
- Cada operación financiera (gasto, cobro, transfer) debe generar póliza contable
- Póliza = registro en libro diario SAT
- Sin póliza → contador no puede cerrar libro → incumplimiento

### DECISIÓN
**Genera automática por trigger** en cada operación:
- GastoCheck: INSERT expense → EXPENSE voucher
- CobraCheck: INSERT collection → INCOME voucher  
- BancoCheck: RECONCILE → TRANSFER voucher

**Folio secuencial**: por company + mes + tipo
- Ej: GC-2024-06-00001, GC-2024-06-00002, ...
- **NUNCA gaps**: crítico para SAT

**Validación**: debit = credit (siempre)
- Si no cuadra → error, no inserta

### IMPLEMENTACIÓN
```sql
-- Edge Function: create_accounting_voucher
CREATE OR REPLACE FUNCTION create_accounting_voucher(
  p_company_id UUID,
  p_source_module TEXT,
  p_source_id UUID,
  p_type TEXT,  -- 'EXPENSE' | 'INCOME' | 'TRANSFER'
  p_amount NUMERIC,
  p_description TEXT
) RETURNS UUID AS $$
BEGIN
  -- 1. Get next folio
  -- 2. Create voucher header
  -- 3. Create debit entry (bank account)
  -- 4. Create credit entry (revenue/expense account)
  -- 5. Validate debit = credit
  -- 6. Return voucher_id
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger en expenses table
CREATE TRIGGER after_expense_insert
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION on_expense_insert();

-- Función trigger
CREATE OR REPLACE FUNCTION on_expense_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_accounting_voucher(
    NEW.company_id,
    'gastocheck',
    NEW.id,
    'EXPENSE',
    NEW.total,
    'Gasto: ' || NEW.category
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### ESTADO
- [ ] Edge Function implementada
- [ ] Triggers en expenses table
- [ ] Triggers en collections table
- [ ] Triggers en reconciliations table
- [ ] Tests: folio secuencial, debit=credit

---

## ADR-4: Auditoría Fiscal Completa

### CONTEXTO
- SAT requiere: quién operó, cuándo, dónde, qué cambió
- Incumplimiento = no puedes probar quién hizo qué

### DECISIÓN
**Campos obligatorios en TODAS las tablas críticas**:
- `created_by` ✅ (existe)
- `created_at` ✅ (existe)
- `updated_by` ❌ (agregar)
- `updated_at` ✅ (existe)
- `change_reason` ❌ (agregar)

**Tabla centralizada: `audit_log`** (para trazabilidad completa)
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'INSERT' | 'UPDATE' | 'DELETE' (soft)
  changed_fields JSONB,  -- {campo_anterior: valor, campo_nuevo: valor}
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMP NOT NULL DEFAULT now(),
  user_ip INET,
  user_agent TEXT
);
```

**Captura en app**:
```typescript
// middleware: apps/web/lib/audit-middleware.ts
export function useAudit() {
  return {
    log: async (action: 'INSERT'|'UPDATE'|'DELETE', tableName: string, recordId: string, changes?: any) => {
      const ip = await getUserIp()
      const userAgent = navigator.userAgent
      await supabase.rpc('log_audit', {
        p_action: action,
        p_table_name: tableName,
        p_record_id: recordId,
        p_changes: changes,
        p_ip: ip,
        p_user_agent: userAgent
      })
    }
  }
}
```

### ESTADO
- [ ] Agregar campos updated_by, change_reason a tablas
- [ ] Crear tabla audit_log
- [ ] Crear Edge Function log_audit
- [ ] Integrar middleware en app + web
- [ ] Tests: auditoría completa sin gaps

---

## ADR-5: Conservación de Registros 5 Años

### CONTEXTO
- SAT requiere: guardar XML, PDF, pólizas por 5 años mínimo
- Borrar = delito fiscal (cancelación de RFC)

### DECISIÓN
**Soft delete siempre** (is_active = false, nunca DROP)
**Archivo en bucket de Supabase**:
```
gs://gastocheck-fiscal-5y/
  ├── cfdis/
  │   ├── 2026/
  │   │   ├── uuid_abc123.xml
  │   │   ├── uuid_abc123.pdf
  ├── polizas/
  │   ├── 2026/
  │   │   ├── GC-2026-06-00001.xml
  ├── bank-statements/
      ├── 2026/
          ├── 20260615_account123.ofx
```

**Backup automático**: 
- Diario a Google Cloud (retention 2000 days)
- Encriptado en tránsito (HTTPS)

### ESTADO
- [ ] Crear bucket fiscal-5y
- [ ] Configurar retention policy
- [ ] Implementar backup automático
- [ ] Documentar restore process

---

## ADR-6: Retenciones ISR e IVA

### CONTEXTO
- Servicios profesionales → retención ISR (10-35% según tipo)
- Servicios de transporte, comisiones → retención IVA (10%)
- No retener = multa

### DECISIÓN
**Tabla de reglas por categoría**:
```sql
CREATE TABLE withholding_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  expense_category TEXT NOT NULL,  -- 'professional_services', 'commission', etc
  isr_rate DECIMAL(5,2),  -- 10.00, 15.00, etc
  iva_rate DECIMAL(5,2),  -- 10.00
  applies_over DECIMAL(15,2),  -- min amount to apply
  is_active BOOLEAN DEFAULT true
);
```

**Generación automática**:
- En CREATE expense: detectar categoría
- Aplicar regla de retención
- Crear voucher de retención
- Generar comprobante PDF (con firma SAT)

### ESTADO
- [ ] Tabla withholding_rules
- [ ] Cálculo automático en expense create
- [ ] Generación comprobante retención
- [ ] Integración con PAC (firma)

---

## ADR-7: Exportación CONTPAQi

### CONTEXTO
- Contador usa CONTPAQi (software contable SAT-compliant)
- Necesita pólizas en XML que entienda

### DECISIÓN
**Formato XML CONTPAQi** (exportable desde BancoCheck):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Polizas>
  <Encabezado NumPoliza="1" Fecha="2026-06-15" Concepto="Gasto..." />
  <Movimiento Cuenta="4000" Debe="1000.00" />
  <Movimiento Cuenta="5100" Haber="1000.00" />
</Polizas>
```

**Botón en BancoCheck**:
```
[Exportar a CONTPAQi] → descarga XML
  → Contador abre en CONTPAQi
  → Click "Importar"
  → Pólizas importadas automáticamente
```

### ESTADO
- [ ] Investigar formato XML CONTPAQi exact
- [ ] Crear convertidor vouchers → XML
- [ ] Botón exportar en BancoCheck UI
- [ ] Tests: XML válido, importable

---

## ADR-8: Integración SAT APIs

### CONTEXTO
- SAT ofrece APIs para validar, consultar, reportar
- Crítico para mantener histórico en sync con SAT

### DECISIÓN
**Usar 3 endpoints SAT**:

1. **RFC Validation** (ADR-2 → ya decidido)
2. **Consulta Status CFDI** (web dashboard)
   - Endpoint: /validation/cfdi/{uuid}
   - Respuesta: vigente | cancelado | not_found
   - Usar en FacturaCheck para alertar si CFDI se cancela

3. **Reporte Mensual**
   - Endpoint: /reports/monthly/{year}/{month}
   - Reportar all CFDIs emitidas/recibidas
   - Usar: contador lo hace mensualmente (automático en future)

### ESTADO
- [ ] Documentar endpoints SAT
- [ ] Crear Edge Functions para cada endpoint
- [ ] Integrar en FacturaCheck dashboard
- [ ] Alertas cuando status cambia

---

## RESUMEN DECISIONES

| ADR | Tema | Decisión | Timeline |
|-----|------|----------|----------|
| 1 | PAC Timbre | FINANZAUTO (SOLUCIONES) | Semana 1 |
| 2 | RFC Validation | SAT API + PAC hybrid | Semana 1 |
| 3 | Pólizas | Automáticas por trigger | Semana 1 |
| 4 | Auditoría | audit_log centralizado | Semana 1 |
| 5 | Conservación | Bucket 5 años + backup | Semana 2 |
| 6 | Retenciones | Tablas + cálculo automático | Semana 2 |
| 7 | CONTPAQi | XML exportable | Semana 2 |
| 8 | SAT APIs | 3 endpoints integrados | Semana 3 |

---

## ⚠️ RESTRICCIONES NO NEGOCIABLES

```
✅ SOFT DELETE SIEMPRE (no borrar físico)
✅ AUDITORÍA COMPLETA (quién, qué, cuándo)
✅ RFC VALIDADO CONTRA SAT (no fantasmas)
✅ CFDIs TIMBRADAS CON PAC (vigentes)
✅ PÓLIZAS GENERADAS AUTOMÁTICAS (no gaps)
✅ 5 AÑOS DE CONSERVACIÓN (backup garantizado)
```

Si se viole cualquiera de estas:
- Multa SAT: $50,000 - $500,000 MXN
- Cancelación RFC: fin de negocio
- Cárcel: si es reincidente + falsificación

