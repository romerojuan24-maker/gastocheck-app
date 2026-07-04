# 🧾 FacturaCheck — Arquitectura Completa

**Objetivo**: Sistema integral de facturación CFDI con Facturama + Crédito + Reportes + Integración CobraCheck  
**Responsables**: Juan (diseño) + Daniel (implementación)  
**Status**: EN DISEÑO (esperando análisis competencia)  
**Timeline**: 4-6 semanas MVP

---

## 📋 REQUISITOS (Recolectados)

### Core Obligatorio
- [ ] Generación CFDI 4.0 (Ingreso, Egreso, Pago, Traslado)
- [ ] Timbre digital con **Facturama** como PAC
- [ ] Folio secuencial automático (sin gaps)
- [ ] RFC emisor + receptor validado
- [ ] Firma digital con certificado SAT
- [ ] Almacenamiento XML 5 años
- [ ] Cancelación digital con acta

### Distintivo (Requerido para diferencial)
- [ ] **Sistema de Saldo/Crédito**:
  - Compra de timbres con saldo prepagado
  - Consumo automático al timbrar
  - Línea de sobregiro para urgencias (configurable)
  - Recarga automática vía webhook Facturama

- [ ] **Distribución Comprobantes**:
  - Email (automático)
  - WhatsApp (a emisor + receptor)
  - Descarga archivo (ZIP con XML + PDF)
  - Historial de envíos

- [ ] **Integración CobraCheck** (PRIORITARIA):
  - CobraCheck genera ingreso → auto-crea CFDI en FacturaCheck
  - Factura vinculada a cobro (relación 1:1)
  - Status sincronizado (si se cancela cobro → cancela CFDI)
  - Cliente visto en CobraCheck aparece en FacturaCheck

- [ ] **Integración otros módulos**:
  - GastoCheck: genera CFDI egreso (compras)
  - BancoCheck: CFDI vinculada a transacción bancaria
  - Reportes consolidados por empresa

- [ ] **Reportes por Empresa/Período**:
  - Total CFDIs emitidas vs recibidas
  - Ingresos por cliente
  - Egresos por proveedor
  - Impuestos (IVA, IEPS, retenciones)
  - Comprobantes pendientes vs pagados
  - Auditoría (quién, cuándo, qué)

- [ ] **Cumplimiento Fiscal Perfecto**:
  - RFC validado contra SAT
  - Retenciones automáticas (ISR, IVA)
  - Comprobante de retención digital
  - Pólizas contables generadas automáticamente
  - Auditoría fiscal completa (5 años)
  - Exportación CONTPAQi para contador

- [ ] **Modelo de Precios Flexible**:
  - **Plan Fijo**: $X/mes por Y timbres (descuento por volumen)
  - **Destajo**: $Z por cada timbre (sin compromiso)
  - **Línea de Sobregiro**: 10-20% crédito extra para urgencias
  - **Compra de Timbres**: sencilla vía dashboard (1-click checkout)

- [ ] **Seguridad**:
  - Encriptación en tránsito (HTTPS)
  - Encriptación en reposo (certificados SAT)
  - RLS policies (solo ver propias CFDIs)
  - Auditoría de acceso (quién descargó, cuándo)
  - No borrar (soft delete)

---

## 🏗️ ARQUITECTURA DE DATOS

### Tablas Core

#### `cfdi_documents` (CFDIs emitidas)
```sql
CREATE TABLE cfdi_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Identificación CFDI
  uuid_cfdi VARCHAR(36) UNIQUE,  -- Del timbre
  folio VARCHAR(40) NOT NULL,
  serie VARCHAR(25),
  numero_secuencial INTEGER,  -- Para validar sin gaps
  
  -- Datos fiscales
  rfc_emisor VARCHAR(13) NOT NULL,
  rfc_receptor VARCHAR(13) NOT NULL,
  razon_social_emisor TEXT,
  razon_social_receptor TEXT,
  
  -- Contenido
  cfdi_type VARCHAR(1) NOT NULL,  -- 'I'|'E'|'P'|'T'
  concepto TEXT,
  items JSONB NOT NULL,  -- [{clave, descripcion, cantidad, unitario, subtotal, iva, ieps}]
  
  -- Montos
  subtotal DECIMAL(15,2),
  descuento DECIMAL(15,2) DEFAULT 0,
  iva DECIMAL(15,2) DEFAULT 0,
  ieps DECIMAL(15,2) DEFAULT 0,
  retenciones JSONB,  -- [{tipo: 'ISR'|'IVA', monto}]
  total DECIMAL(15,2) NOT NULL,
  
  -- Método/Forma pago
  metodo_pago VARCHAR(3),
  forma_pago VARCHAR(2),
  
  -- Timbre
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft|pending|timbrado|cancelled|error
  uuid_timbre_facturama VARCHAR(36),
  timbrado_at TIMESTAMP,
  xml_storage_path TEXT,
  pdf_storage_path TEXT,
  
  -- Integraciones
  source_module TEXT,  -- 'cobracheck'|'gastocheck'|'manual'
  source_id UUID,  -- ID del cobro/gasto
  
  -- Cancelación
  motivo_cancelacion TEXT,
  acta_cancelacion_path TEXT,
  cancelado_at TIMESTAMP,
  
  -- Auditoría
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT valid_rfc CHECK (rfc_emisor ~ '^[A-ZÑ&]{3,4}\d{6}[A-V0-9]{3}$'),
  CONSTRAINT valid_uuid_format CHECK (uuid_cfdi ~ '^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$')
);

CREATE UNIQUE INDEX idx_cfdi_folio_empresa 
  ON cfdi_documents(company_id, folio, serie) 
  WHERE is_active = true;
  
CREATE INDEX idx_cfdi_rfc ON cfdi_documents(rfc_emisor, rfc_receptor);
CREATE INDEX idx_cfdi_status ON cfdi_documents(status);
```

#### `cfdi_credits` (Sistema de crédito)
```sql
CREATE TABLE cfdi_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Saldo
  saldo_disponible DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_congelado DECIMAL(15,2) DEFAULT 0,  -- En línea de sobregiro
  limite_sobregiro DECIMAL(15,2) DEFAULT 0,
  
  -- Historial
  plan_type VARCHAR(20),  -- 'fixed'|'payperuse'|'hybrid'
  timbres_mensuales INTEGER,  -- Si es plan fijo
  precio_timbre_unitario DECIMAL(10,2),  -- Si es destajo
  
  -- Consumo actual
  timbres_usados_mes INTEGER DEFAULT 0,
  proxima_fecha_reset DATE,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE cfdi_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  credit_id UUID NOT NULL REFERENCES cfdi_credits(id),
  
  -- Tipo de operación
  tipo VARCHAR(20) NOT NULL,  -- 'recarga'|'consumo_timbre'|'pago_manual'|'sobregiro_cobro'
  monto DECIMAL(15,2) NOT NULL,
  saldo_anterior DECIMAL(15,2),
  saldo_posterior DECIMAL(15,2),
  
  -- Referencia
  cfdi_id UUID REFERENCES cfdi_documents(id),
  facturama_transaction_id VARCHAR(50),
  
  -- Auditoría
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  descripcion TEXT
);
```

#### `cfdi_distributions` (Distribución de comprobantes)
```sql
CREATE TABLE cfdi_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  cfdi_id UUID NOT NULL REFERENCES cfdi_documents(id),
  
  -- Canales de distribución
  enviado_email BOOLEAN DEFAULT false,
  email_timestamp TIMESTAMP,
  email_receptor TEXT,
  email_status VARCHAR(20),  -- sent|failed|bounced
  
  enviado_whatsapp BOOLEAN DEFAULT false,
  whatsapp_timestamp TIMESTAMP,
  whatsapp_numero VARCHAR(15),
  whatsapp_status VARCHAR(20),  -- sent|failed|undelivered
  
  descargado BOOLEAN DEFAULT false,
  descarga_timestamp TIMESTAMP,
  
  -- Auditoría
  enviado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_distributions_cfdi ON cfdi_distributions(cfdi_id);
```

#### `cfdi_cobracheck_links` (Integración CobraCheck)
```sql
CREATE TABLE cfdi_cobracheck_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Relación 1:1
  cobra_movement_id UUID NOT NULL UNIQUE REFERENCES cobra_movements(id),
  cfdi_id UUID NOT NULL UNIQUE REFERENCES cfdi_documents(id),
  
  -- Sincronización
  status_sync VARCHAR(20),  -- synchronized|pending|error
  ultima_sync TIMESTAMP,
  
  -- Auditoría
  linked_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 🔄 FLUJOS PRINCIPALES

### FLUJO 1: Emisión Manual CFDI

```
Usuario abre FacturaCheck
  ↓
Selecciona "Nueva CFDI"
  ↓
Ingresa: RFC receptor, concepto, ítems, montos
  ↓
Sistema calcula: subtotal, IVA (16%), retenciones (si aplica)
  ↓
Sistema valida:
  - RFC formato + SAT padrón
  - Folio sin gaps
  - Monto vs saldo disponible
  ↓
Usuario revisa y confirma
  ↓
Sistema:
  1. Genera XML CFDI 4.0
  2. Descuenta saldo (o agrega sobregiro si es necesario)
  3. Envía XML a Facturama para timbre
  ↓
Facturama devuelve: UUID + XML timbrado
  ↓
Sistema:
  1. Almacena XML en bucket (5 años)
  2. Genera PDF
  3. Crea registro en cfdi_documents (status='timbrado')
  ↓
Sistema ofrece distribución:
  - "Enviar por email"
  - "Enviar por WhatsApp"
  - "Descargar"
```

### FLUJO 2: Integración CobraCheck (AUTO)

```
CobraCheck: Cobrador registra cobro → status='paid'
  ↓
Trigger: on_collection_paid()
  ↓
Sistema genera CFDI automáticamente:
  1. RFC cliente → de CobraCheck
  2. Monto → del cobro
  3. Concepto → "Pago de servicio"
  4. Folio → secuencial automático
  ↓
Sistema consume saldo FacturaCheck
  ↓
Si saldo < monto:
  - Usar línea sobregiro (si disponible)
  - O marcar como "pendiente timbre" (payment_pending)
  ↓
Sistema crea link en cfdi_cobracheck_links
  ↓
Distribución automática:
  - Email cliente (con XML + PDF)
  - WhatsApp cliente (link descarga)
  - Email empresa (confirmación)
```

### FLUJO 3: Compra de Timbres (Saldo)

```
Usuario abre "Administrar Saldo"
  ↓
Ve: saldo actual, límite sobregiro, historial consumo
  ↓
Selecciona plan:
  - "Plan 100 timbres/mes: $499"
  - "Destajo: $5 por timbre"
  - "Híbrido: 50 timbres + destajo"
  ↓
Sistema redirige a Facturama checkout
  ↓
Usuario paga (tarjeta, trasferencia, etc)
  ↓
Facturama webhook: on_payment_received()
  ↓
Sistema:
  1. Actualiza cfdi_credits (saldo_disponible += monto)
  2. Registra transacción en cfdi_credit_transactions
  3. Notifica usuario (email + app)
```

---

## 🔌 INTEGRACIONES

### Integración Facturama

```
Edge Function: supabase/functions/stamp-cfdi-facturama

Input: {
  xml_content: string,
  company_rfc: string,
  facturama_api_key: string
}

Output: {
  uuid: string,
  xml_timbrado: string,
  pdf_url: string,
  fecha_timbre: string,
  folio_timbre: string
}

Endpoint: POST https://api.facturama.mx/v3/cfdi/stamp
Auth: X-API-KEY header
Timeout: 30s
Retry: 3x en caso de error
```

### Integración CobraCheck

```
Trigger: cobra_movements.status = 'paid'
  → Call create_cfdi_from_cobra_movement()
  
Campos necesarios en cobra_movements:
  - client_rfc (obligatorio)
  - payment_amount (obligatorio)
  - payment_method (obligatorio)
  - bank_account_id (optional)
  
Campos que genera FacturaCheck:
  - cfdi_type = 'I' (Ingreso)
  - concepto = "Pago de cobranza"
  - folio = secuencial automático
```

### Integración GastoCheck

```
Trigger: expenses.status = 'approved'
  → Call create_cfdi_from_expense()
  
Genera CFDI egreso:
  - rfc_receptor = expense.supplier_rfc
  - monto = expense.total
  - iva = expense.iva
  - cfdi_type = 'E'
```

### Integración BancoCheck

```
View: bank_transactions
  - Mostrar link a CFDI si source_module = 'facturacheck'
  - Reconciliar automáticamente si CFDI timbrada
```

---

## 📊 REPORTES POR EMPRESA

### Reporte 1: Dashboard Principal
- Total CFDIs emitidas (mes actual)
- Total ingresos vs egresos
- Promedio por CFDI
- % canceladas vs vigentes
- Crédito disponible
- Timbres usados vs plan

### Reporte 2: CFDIs por Período
```sql
SELECT 
  DATE_TRUNC('month', timbrado_at)::DATE as mes,
  cfdi_type,
  COUNT(*) as cantidad,
  SUM(total) as monto_total,
  COUNT(CASE WHEN status='cancelled' THEN 1 END) as canceladas
FROM cfdi_documents
WHERE company_id = $1 AND is_active = true
GROUP BY mes, cfdi_type
ORDER BY mes DESC;
```

### Reporte 3: Ingresos por Cliente
```sql
SELECT 
  rfc_receptor,
  razon_social_receptor,
  COUNT(*) as facturas,
  SUM(total) as monto_total,
  MAX(timbrado_at) as ultima_factura
FROM cfdi_documents
WHERE company_id = $1 AND cfdi_type = 'I'
GROUP BY rfc_receptor, razon_social_receptor
ORDER BY monto_total DESC;
```

### Reporte 4: Impuestos Acumulados
```sql
SELECT 
  DATE_TRUNC('month', timbrado_at)::DATE as mes,
  SUM(iva) as iva_total,
  SUM((retenciones->>'ISR')::DECIMAL) as isr_total,
  SUM((retenciones->>'IVA')::DECIMAL) as iva_retenido
FROM cfdi_documents
WHERE company_id = $1
GROUP BY mes;
```

---

## 💳 MODELO DE PRECIOS

### Opción A: Plan Fijo
```
Plan Básico: $299/mes
  - 50 timbres/mes
  - Email ilimitado
  - WhatsApp ilimitado
  - Reportes básicos
  - Integración CobraCheck incluida

Plan Profesional: $599/mes
  - 250 timbres/mes
  - Email + WhatsApp + API
  - Reportes avanzados
  - Integración con GastoCheck + BancoCheck
  - Cancelaciones digitales
  - Auditoría completa

Plan Empresarial: $999/mes
  - Ilimitado timbres
  - Multi-empresa
  - API ilimitada
  - Custom reportes
  - Soporte prioritario
  - Capacitación usuario
```

### Opción B: Destajo
```
$5 por timbre (sin compromiso)
  - Recarga mínima: $50 (10 timbres)
  - Sin expiración de crédito
  - Email + WhatsApp incluido
  - Línea de sobregiro: hasta $200 (+10%)
```

### Opción C: Híbrido (RECOMENDADO)
```
$399/mes
  - 100 timbres incluidos
  - Adicionales: $4 por timbre
  - Ideal para pequeña/mediana empresa
  - Mejor ratio precio/volumen
```

---

## 🔒 CUMPLIMIENTO FISCAL

### RFC Validation
```typescript
async function validateRfcAndSync(rfc: string) {
  // 1. Validar formato
  if (!isValidRfcFormat(rfc)) throw new Error('RFC formato inválido')
  
  // 2. Cache local (7 días)
  const cached = await getRfcCache(rfc)
  if (cached) return cached
  
  // 3. SAT API
  const satResult = await satApi.checkRfc(rfc)
  if (!satResult.active) throw new Error('RFC cancelado o inexistente')
  
  // 4. Guardar en cache
  await saveRfcCache(rfc, satResult)
  return satResult
}
```

### Retenciones Automáticas
```sql
CREATE TABLE cfdi_withholding_rules (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  expense_category TEXT,
  isr_rate DECIMAL(5,2),  -- 10, 15, 20, 25, 30, 35%
  iva_rate DECIMAL(5,2),  -- 10%
  applies_over DECIMAL(15,2),  -- monto mínimo
  is_active BOOLEAN DEFAULT true
);

-- Trigger al crear CFDI egreso
CREATE TRIGGER apply_withholdings_on_cfdi_insert
  AFTER INSERT ON cfdi_documents
  FOR EACH ROW
  WHEN (NEW.cfdi_type = 'E')
  EXECUTE FUNCTION calculate_withholdings();
```

### Auditoría Fiscal
- Quién timbró (created_by)
- Cuándo timbró (created_at)
- Quién modificó (updated_by)
- Qué cambió (change_log)
- IP origen (user_ip)
- Dispositivo (device_info)
- Tabla: `audit_log` centralizada

### 5-Year Retention
- XML almacenado en bucket: `fiscal-5y-cfdis`
- Backup diario a Google Cloud
- Soft delete (never physical delete)
- Restore procedure documentada

---

## 🎯 ROADMAP MVP (4-6 semanas)

### SEMANA 1: Core CFDI
- [ ] Diseño BD completo
- [ ] Generación XML CFDI 4.0
- [ ] Integración Facturama (timbre)
- [ ] UI: Crear CFDI manual

### SEMANA 2: Saldo + Distribución
- [ ] Sistema de crédito
- [ ] Email automático
- [ ] WhatsApp automático
- [ ] Descarga PDF

### SEMANA 3: Integración CobraCheck
- [ ] Trigger: cobro → CFDI auto
- [ ] Link cfdi_cobracheck_links
- [ ] Sincronización status
- [ ] UI en CobraCheck

### SEMANA 4: Reportes
- [ ] Dashboard principal
- [ ] Reportes por período
- [ ] Reportes por cliente
- [ ] Impuestos acumulados

### SEMANA 5: Cumplimiento Fiscal
- [ ] RFC validation SAT
- [ ] Retenciones automáticas
- [ ] Auditoría fiscal
- [ ] 5-year bucket

### SEMANA 6: Polish + Testing
- [ ] Seguridad (RLS, auditoría acceso)
- [ ] QA completo
- [ ] Documentación
- [ ] Capacitación usuario

---

## 🏁 CHECKLIST GO-LIVE

```
✅ Timbre PAC (Facturama) funcionando
✅ RFC validado contra SAT
✅ CFDI generadas correctamente
✅ Timbres consumidos automáticamente
✅ CobraCheck → FacturaCheck integrado
✅ Email + WhatsApp enviando
✅ Reportes generando
✅ Retenciones calculadas
✅ Auditoría fiscal completa
✅ 5 años archivado
✅ Crédito/sobregiro funcionando
✅ RLS policies aplicadas
✅ Zero data loss (soft delete)
✅ Contador valida CONTPAQi export
```

