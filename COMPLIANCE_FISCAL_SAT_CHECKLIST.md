# 🏛️ CHECKLIST CUMPLIMIENTO FISCAL SAT — CHECK SUITE

**Objetivo**: Asegurar que CHECK SUITE cumple con TODOS los requisitos fiscales mexicanos  
**Versión**: 2026-07-04  
**Responsable**: Auditoría fiscal + Legal

---

## 📋 REQUISITOS SAT OBLIGATORIOS

### 1️⃣ **CFDI — Comprobante Fiscal Digital por Internet**

| Requisito | Status | Módulo | Notas |
|-----------|--------|--------|-------|
| Timbre digital (PAC) | ❓ | FacturaCheck | ¿Integrado con PAC? |
| Estructura XML válida | ❓ | FacturaCheck | ¿Validación XSD? |
| Folio secuencial sin gaps | ❓ | GastoCheck | ¿Se valida en generación? |
| Número de serie en factura | ❓ | GastoCheck | ¿Campo requerido? |
| RFC emisor + receptor | ❓ | FacturaCheck | ¿Validación RFC? |
| Fecha válida (no futura) | ❓ | FacturaCheck | ¿Validación timestamps? |
| Vigencia CFDI (30 días) | ❓ | FacturaCheck | ¿Alert cuando vence? |
| Cancelación de CFDIs | ❓ | FacturaCheck | ¿Comprobante de cancelación? |
| UUID único por CFDI | ✅ | FacturaCheck | Generado por timbre |

### 2️⃣ **RFC — Registro Federal de Contribuyentes**

| Requisito | Status | Módulo | Notas |
|-----------|--------|--------|-------|
| Validación RFC emisor | ❓ | Todos | ¿Formato correcto? |
| Validación RFC receptor | ❓ | Todos | ¿Existe en SAT? |
| RFC extranjero (sin homoclave) | ❓ | BancoCheck | Vimos bug DHL |
| CURP persona física | ❓ | GastoCheck | ¿Capturado? |
| Razón social vs RFC | ❓ | FacturaCheck | ¿Coherencia validada? |

### 3️⃣ **RETENCIONES — ISR e IVA**

| Requisito | Status | Módulo | Notas |
|-----------|--------|--------|-------|
| Cálculo retención ISR | ❓ | BancoCheck | ¿Automático? |
| Cálculo retención IVA | ❓ | BancoCheck | ¿Automático? |
| Comprobante retención | ❓ | BancoCheck | ¿PDF generado? |
| Registro en SAT | ❓ | BancoCheck | ¿Se reporta a SAT? |
| Póliza de retención | ❓ | BancoCheck | ¿En contabilidad? |

### 4️⃣ **PÓLIZAS CONTABLES**

| Requisito | Status | Módulo | Notas |
|-----------|--------|--------|-------|
| Folio secuencial póliza | ❓ | BancoCheck | ¿Sin gaps? |
| Fecha póliza = fecha transacción | ❓ | BancoCheck | ¿Validado? |
| Cuentas contables SAT | ❓ | BancoCheck | ¿Catálogo actualizado? |
| Débito = Crédito siempre | ✅ | BancoCheck | Validado en schema |
| Concepto claro en póliza | ❓ | BancoCheck | ¿Descripción SAT? |
| Exportación CONTPAQi | ❓ | BancoCheck | ¿Formato XML correcto? |
| Exportación SAT | ❓ | BancoCheck | ¿XML de pólizas? |

### 5️⃣ **CONSERVACIÓN DE REGISTROS**

| Requisito | Status | Módulo | Notas |
|-----------|--------|--------|-------|
| Guardar XML original CFDI | ❓ | FacturaCheck | ¿5 años? |
| Guardar PDF factura | ❓ | FacturaCheck | ¿Firmado? |
| Guarda transacciones | ❓ | BancoCheck | ¿Histórico completo? |
| Guarda auditoría (quién, qué, cuándo) | ❓ | Todos | ¿Log_eventos? |
| Exportación fiscal anual | ❓ | BancoCheck | ¿Respaldo? |
| No borrar registros (soft delete) | ✅ | Todos | is_active = false |

### 6️⃣ **AUDITORÍA FISCAL**

| Requisito | Status | Módulo | Notas |
|-----------|--------|--------|-------|
| Quién creó registro | ✅ | Todos | created_by |
| Cuándo se creó | ✅ | Todos | created_at |
| Quién modificó | ❓ | Todos | updated_by? |
| Cuándo se modificó | ✅ | Todos | updated_at |
| Razón de cambio | ❓ | Todos | change_reason? |
| IP origen | ❓ | Todos | user_ip? |
| Dispositivo | ❓ | Todos | device_info? |
| Trazabilidad de errores | ❓ | Todos | error_log? |

### 7️⃣ **VALIDACIONES OBLIGATORIAS**

| Requisito | Status | Módulo | Notas |
|-----------|--------|--------|-------|
| RFC formato válido | ❓ | Todos | Regex SAT |
| RFC activo en SAT | ❓ | Todos | Consulta API SAT |
| Cantidad decimal (máx 2) | ✅ | Todos | DECIMAL(15,2) |
| Moneda válida (MXN, USD, EUR) | ✅ | BancoCheck | Check constraint |
| Fecha no futura | ❓ | Todos | Validación app |
| Fecha mínima (2008-01-01) | ❓ | Todos | Reforma fiscal |
| IVA 16% o 0% o exento | ❓ | GastoCheck | ¿Validado? |
| Concepto de pago válido | ❓ | BancoCheck | ¿Enum SAT? |

### 8️⃣ **INTEGRACIÓN SAT (APIS)**

| Requisito | Status | Módulo | Notas |
|-----------|--------|--------|-------|
| PAC timbre digital | ❓ | FacturaCheck | ¿Cuál PAC? |
| Validación RFC en SAT | ❓ | Todos | ¿API-RFC? |
| Consulta estado CFDI | ❓ | FacturaCheck | ¿Status en SAT? |
| Cancelación digital | ❓ | FacturaCheck | ¿Acta de cancelación? |
| Comprobante retención digital | ❓ | BancoCheck | ¿Timbre ret? |

### 9️⃣ **POR MÓDULO**

#### **GastoCheck**
- [ ] Captura RFC proveedor
- [ ] Captura CFDI recibida (UUID)
- [ ] Valida fecha no futura
- [ ] Valida IVA tasa correcta
- [ ] Guarda XML original
- [ ] Póliza contable generada
- [ ] Si hay retención → comprobante generado

#### **CobraCheck**
- [ ] Genera CFDI ingreso (si aplica)
- [ ] Valida RFC cliente
- [ ] Folio secuencial sin gaps
- [ ] Timbre digital ejecutado
- [ ] Conserva XML timbrado
- [ ] Genera póliza contable ingreso
- [ ] Reporta a SAT

#### **BancoCheck**
- [ ] Reconcilia con CFDIs
- [ ] Calcula retenciones automáticas
- [ ] Genera comprobantes retención
- [ ] Pólizas contables todas reconciliadas
- [ ] Exporta CONTPAQi
- [ ] Auditoría completa (user, timestamp, etc)

#### **FacturaCheck**
- [ ] Gestiona CFDIs recibidas (búsqueda, filtro)
- [ ] Valida estructura XML
- [ ] Consulta estado en SAT
- [ ] Procesa cancelaciones
- [ ] Genera reporte de vencidas
- [ ] Conserva archivos 5 años

---

## 🔴 CRÍTICAS (Debe estar 100% antes de producción)

```
❌ SIN ESTOS, NO PUEDES VENDER:
  1. Timbre digital PAC funcionando
  2. Validación RFC con SAT activa
  3. Estructura CFDI válida (XSD)
  4. Auditoría fiscal completa
  5. No se puede borrar registros (soft delete)
  6. Conservación XML 5 años
  7. Pólizas contables generadas automáticamente
```

---

## 📊 AUDITORÍA REALIZADA

| Área | % Cubierto | Riesgo |
|------|-----------|--------|
| CFDI | 40% | 🔴 Alto |
| RFC | 30% | 🔴 Alto |
| Retenciones | 0% | 🔴 Crítico |
| Pólizas | 50% | 🟡 Medio |
| Auditoría | 60% | 🟡 Medio |
| Conservación | 70% | 🟡 Medio |
| **PROMEDIO** | **42%** | **🔴 ALTO** |

---

## ⚠️ RIESGOS LEGALES

- **Multa SAT**: No timbrar CFDIs = $50,000 - $500,000
- **Cancelación RFC**: No guardar XML = 5 años de retención
- **Auditoría fiscal**: Sin auditoría completa = evasión fiscal
- **Sanciones**: Falsificar CFDIs = cárcel + multas

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### FASE 1: CRÍTICOS (Esta semana)
- [ ] PAC integration (contratar PAC)
- [ ] RFC validation (API SAT)
- [ ] Pólizas automáticas
- [ ] Auditoría fiscal fields

### FASE 2: RETENCIONES (Próxima semana)
- [ ] Cálculo ISR/IVA
- [ ] Comprobantes retención
- [ ] Reporte SAT

### FASE 3: CONSERVACIÓN (2 semanas)
- [ ] Backup XML 5 años
- [ ] Restauración garantizada
- [ ] Auditoría interna

### FASE 4: INTEGRACIÓN SAT (3 semanas)
- [ ] Consulta estado CFDI
- [ ] Cancelaciones digitales
- [ ] Reportes a SAT

