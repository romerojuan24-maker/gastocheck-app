# 🔴 PLAN CIERRE DE BRECHAS — FISCAL SAT

**Objetivo**: Cerrabilidad fiscal antes de producción  
**Prioridad**: CRÍTICA  
**Responsables**: Juan (diseño) + Daniel (implementación) + Contador (validación)  
**Timeline**: 2-3 semanas máximo

---

## 📊 ESTADO ACTUAL (Desde Auditoría)

```
Esperando reporte de auditoría fiscal...
(agente: a9773637ab2b49112)
```

**Entrada del Checklist**:
- CFDI: 40% (✅ UUID, ❌ PAC, ❌ timbre, ❌ XSD validation)
- RFC: 30% (❌ API SAT, ✅ formato básico)
- Retenciones: 0% (❌ cálculo, ❌ comprobante, ❌ SAT)
- Pólizas: 50% (⚠️ schema, ❌ export)
- Auditoría: 60% (⚠️ created_by, ❌ updated_by)
- Conservación: 70% (⚠️ soft delete, ❌ 5-year retention)

---

## 🚨 CRÍTICAS (No negociable)

### 1. **PAC Integration — BLOQUEANTE**

**¿Qué es?** Servicio de timbre digital (Finanzauto, SOLUCIONES, Quadrum, etc.)

**Por qué**: Sin timbre, CFDI no es válido ante SAT → no se puede vender

**Status**: ❌ Probablemente no existe integración

**Acción**:
- [ ] Seleccionar PAC (recomendación: SOLUCIONES o Finanzauto)
- [ ] Contratar acctivación + obtener credenciales
- [ ] Implementar call a servicio timbre en FacturaCheck
- [ ] Tests: timbre válido, rechaza XML mal formado, maneja errores

**Estimación**: 2-3 días (incluye setup con PAC + code)

**Owner**: Juan (diseño) + Daniel (implementación)

---

### 2. **RFC Validation con SAT API — BLOQUEANTE**

**¿Qué es?** Validar RFC contra padrón del SAT (existe + activo + sin cancelación)

**Por qué**: Facturar a RFC fantasma = fraude fiscal

**Status**: ❌ No hay integración SAT

**Acción**:
- [ ] Evaluar opciones SAT:
  - SAT API estándar (lento, gratuito, ~2-3 seg)
  - PAC includes RFC validation (más rápido)
  - Servicio tercero (Dun & Bradstreet MX, etc)
- [ ] Implementar en packages/shared/src/validation.ts
- [ ] Validar al crear empresa + al agregar proveedores/clientes
- [ ] Cache local 7 días (no martillear SAT)

**Estimación**: 2 días

**Owner**: Juan (diseño) + Daniel (implementación)

---

### 3. **Pólizas Contables Automáticas — BLOQUEANTE**

**¿Qué es?** Generar póliza en contabilidad cada vez que:
- Se crea gasto en GastoCheck
- Se registra cobro en CobraCheck
- Se reconcilia en BancoCheck

**Por qué**: Contador no puede validar sin póliza → incumplimiento SAT

**Status**: ⚠️ Schema existe, ❌ generación no implementada

**Acción**:
- [ ] Crear Edge Function: `create_accounting_voucher`
- [ ] Trigger: INSERT en expenses → crea voucher EXPENSE
- [ ] Trigger: INSERT en collections → crea voucher INCOME
- [ ] Trigger: RECONCILE en bank_reconciliations → crea voucher TRANSFER
- [ ] Validar siempre: debit = credit
- [ ] Folio secuencial sin gaps

**Estimación**: 2-3 días

**Owner**: Juan (diseño) + Daniel (implementación)

---

### 4. **Auditoría Fiscal Completa — BLOQUEANTE**

**¿Qué es?** Quién, qué, cuándo, dónde para CADA operación

**Campos requeridos**:
- `created_by` ✅ (existe)
- `updated_by` ❌ (falta)
- `updated_at` ✅ (existe)
- `change_reason` ❌ (falta)
- `user_ip` ❌ (falta)
- `device_info` ❌ (falta)

**Por qué**: Si hay auditoría SAT, deben saber quién borró qué y cuándo

**Status**: 60% incompleto

**Acción**:
- [ ] Agregar fields a TODAS las tablas principales:
  - expenses, collections, bank_transactions, bank_reconciliations, accounting_vouchers, cfdi_documents
- [ ] Capturar IP + device en cada operación (desde app + web)
- [ ] Crear tabla `audit_log` centralizado
- [ ] NO permitir borrar (soft delete siempre)

**Estimación**: 1-2 días

**Owner**: Juan (diseño) + Daniel (implementación)

---

## 🟡 ALTOS (Semana 2)

### 5. **Retenciones ISR e IVA**

**¿Qué es?** Calcular automáticamente qué retener a proveedores/servicios

**Por qué**: SAT valida retenciones; si no reportas = multa

**Status**: 0% (no existe)

**Acción**:
- [ ] Crear tabla `withholding_rules` (por categoría expense)
- [ ] Crear tabla `withholding_vouchers` (comprobante retención)
- [ ] Calcular en hook: `useWithholding(expense)`
- [ ] Generar comprobante digital
- [ ] Reportar a SAT en póliza

**Estimación**: 3-4 días

**Owner**: Juan (diseño) + Daniel (implementación)

---

### 6. **Exportación CONTPAQi XML**

**¿Qué es?** Exportar pólizas en formato que entienda Contador (software CONTPAQi)

**Por qué**: Contador usa CONTPAQi; no puedes dar CSV y esperar que lo procese

**Status**: 0% (no existe)

**Acción**:
- [ ] Investigar formato XML CONTPAQi
- [ ] Crear convertidor: accounting_vouchers → XML
- [ ] Botón en BancoCheck: "Exportar a CONTPAQi"
- [ ] Tests: XML válido, números coinciden

**Estimación**: 2 días

**Owner**: Daniel (implementación)

---

### 7. **Conservación 5 Años**

**¿Qué es?** Guardar XML original CFDI, PDFs, pólizas por 5 años

**Por qué**: Auditoría fiscal SAT pide todo en original

**Status**: ⚠️ Soft delete existe, ❌ backup strategy no existe

**Acción**:
- [ ] Crear storage en Supabase (bucket: fiscal-archive-5y)
- [ ] Guardar XML original cada CFDI
- [ ] Guardar PDF factura original
- [ ] Guardar póliza XML original
- [ ] Retention policy: never delete (archival only)
- [ ] Backup automático diario

**Estimación**: 1-2 días (setup)

**Owner**: Juan (diseño)

---

## 🟢 MEDIOS (Semana 3)

### 8. **Consulta Estado CFDI en SAT**

Dashboard que muestre:
- ✅ Validadas
- ⚠️ En revisión
- ❌ Canceladas
- ⏳ Pendiente timbre

---

### 9. **Reportes Mensuales**

- Ingresos vs. egresos
- Retenciones generadas
- Pólizas reconciliadas
- Documentos faltantes

---

## 📋 ROADMAP IMPLEMENTACIÓN

### SEMANA 1 — CRÍTICOS (Esta semana)

**Día 1-2: PAC Integration**
- [ ] Escoger PAC (Finanzauto recomendado)
- [ ] Setup credenciales
- [ ] Implementar en FacturaCheck
- [ ] Tests

**Día 2-3: RFC Validation**
- [ ] SAT API integration
- [ ] Validar RFC en create company
- [ ] Validar RFC en add supplier
- [ ] Cache 7 días

**Día 3-4: Pólizas Automáticas**
- [ ] Edge Function create_voucher
- [ ] Triggers en expenses/collections/reconciliations
- [ ] Tests: debit = credit

**Día 4-5: Auditoría Fiscal**
- [ ] Agregar updated_by, change_reason, ip, device a todas las tablas
- [ ] Capturar IP en app + web
- [ ] Soft delete obligatorio

### SEMANA 2 — ALTOS

**Día 6-7: Retenciones**
- [ ] Tabla withholding_rules
- [ ] Cálculo automático
- [ ] Comprobante generación

**Día 7-8: CONTPAQi Export**
- [ ] Formato XML
- [ ] Botón exportar
- [ ] Tests

### SEMANA 3 — MEDIOS

**Día 9-10: SAT Queries**
- [ ] Consulta estado CFDI
- [ ] Dashboard status
- [ ] Alertas

---

## 🎯 VALIDACIÓN FINAL

**Checklist de cierre** (con contador):
- [ ] Contador ve todas las pólizas (BancoCheck)
- [ ] Contador puede exportar a CONTPAQi
- [ ] Gastos GastoCheck → póliza automática
- [ ] Cobros CobraCheck → póliza automática
- [ ] Auditoría: quién, qué, cuándo, dónde
- [ ] CFDIs timbradas con PAC
- [ ] RFCs validados contra SAT
- [ ] Retenciones calculadas
- [ ] Todos los XMLs archivados 5 años
- [ ] Sin riesgos legales

---

## 💰 PRESUPUESTO APROX

| Item | Costo | Duración |
|------|-------|----------|
| PAC (anual) | $2,000-5,000 MXN | - |
| SAT API (gratuita) | $0 | - |
| Desarrollo (120 hrs) | $60,000-120,000 MXN | 3 semanas |
| **TOTAL** | **$62k-125k MXN** | **3 semanas** |

---

## ⚠️ RIESGOS SI NO SE HACE

```
1. No PAC → CFDIs inválidas → multa $50k-500k
2. No RFC validation → facturar a fantasmas → fraude
3. No auditoría → no puedes probar quién operó → problemas legales
4. No retenciones → no reportar a SAT → penalización
5. No pólizas → contador puede rechazar → no cierre fiscal
6. Borrar registros → incumplimiento SAT → cancelación RFC
```

**Conclusión**: Esto es OBLIGATORIO, no es "nice to have".

