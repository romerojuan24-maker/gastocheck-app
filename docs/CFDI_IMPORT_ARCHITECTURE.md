# 📄 CFDI Import Architecture — Integración XML SAT

**Versión:** 1.0  
**Fecha:** 2026-06-20  
**Alcance:** GastoCheck + CobraCheck (Completar flujo del dinero)  
**Prioridad:** ALTA (Bloquea OTA 1.0 + 1.1)

---

## 📋 Resumen Ejecutivo

**Problema:**
- GastoCheck: Solo captura gastos vía OCR de tickets
  - Pero proveedores facturan directamente (CFDI) sin ticket
  - XML llega al SAT, usuario descarga manualmente
  - Sistema no lo importa → Gasto no registrado
  
- CobraCheck: Usuario registra manualmente cada factura
  - Pero ya emitimos CFDI (están en SAT)
  - Usuario podría descargar XML e importar
  - Sistema no lo soporta → Doble trabajo

**Solución:**
- Importar CFDI recibidos (GastoCheck) + CFDI emitidos (CobraCheck)
- Extraer datos del XML automáticamente
- Detectar duplicados (no importar 2 veces)
- Validar firma digital SAT
- Completar flujo: CFDI → Gasto/Factura → Pago en banco

**Beneficio:**
- Caja cuadra 100% (todos los gastos/cobros capturados)
- Menos trabajo manual
- Mayor precisión contable
- Auditoría completa (SAT + sistema)

---

## 🎯 Casos de Uso

### Caso 1: GastoCheck - CFDI Recibido

```
SITUACIÓN:
Proveedor A (RFC: PRV123456XYZ) me factura:
├─ Monto: $5,000
├─ Fecha: 2026-06-15
├─ Concepto: "Compra papel A4"
├─ Contacto: Sin ticket (directo a mi email)
└─ XML: Descargo del portal SAT

FLUJO ACTUAL (MALO):
1. Usuario recibe email con XML
2. Usuario abre Excel/Google Sheets, ingresa manualmente
3. GastoCheck NO se entera
4. Cuando llega transferencia al banco, no hay gasto para reconciliar
5. CAJA NO CUADRA

FLUJO NUEVO (BUENO):
1. Usuario recibe email con XML
2. Usuario sube XML en GastoCheck: [📎 Importar CFDI]
3. Sistema extrae datos:
   ├─ Proveedor: Proveedor A
   ├─ RFC: PRV123456XYZ
   ├─ Monto: $5,000
   ├─ Fecha: 2026-06-15
   ├─ Concepto: "Compra papel A4"
   ├─ UUID: UUID1234...
   └─ Validación SAT: ✅
4. Sistema CREA GASTO automáticamente
5. Usuario ve en GastoCheck: "Gasto importado de CFDI"
6. Cuando llega transferencia ($5,000 el 16/6), BancoCheck lo reconcilia automáticamente
7. ✅ CAJA CUADRA
```

### Caso 2: CobraCheck - CFDI Emitido

```
SITUACIÓN:
Emito factura a Cliente B:
├─ RFC: CLT456789ABC
├─ Monto: $10,000
├─ Fecha: 2026-06-15
├─ Vencimiento: 2026-06-25
└─ XML ya está en SAT (lo emití)

FLUJO ACTUAL (MALO):
1. Usuario abre portal SAT/FolioX
2. Usuario copia datos manualmente a CobraCheck
3. Crea factura duplicada (si ya la creó en sistema)
4. Riesgo de inconsistencias

FLUJO NUEVO (BUENO):
1. Usuario en CobraCheck: [📎 Importar Factura del SAT]
2. Usuario sube XML (o proporciona UUID)
3. Sistema extrae datos:
   ├─ Cliente: Cliente B
   ├─ RFC: CLT456789ABC
   ├─ Monto: $10,000
   ├─ Fecha: 2026-06-15
   ├─ Vencimiento: 2026-06-25
   ├─ Concepto/items: Detallados
   ├─ UUID: UUID5678...
   └─ Validación SAT: ✅
4. Sistema CREA FACTURA automáticamente (o asocia si existe)
5. Usuario registra pago cuando llega depósito
6. Póliza se genera automáticamente
7. ✅ FLUJO COMPLETO
```

### Caso 3: Validación de Duplicados

```
ESCENARIO A: Importación duplicada
1. Usuario sube XML de CFDI (UUID1234...)
2. Sistema crea gasto/factura
3. Usuario (sin querer) sube mismo XML otra vez
4. Sistema detecta: "Este UUID ya fue importado"
5. Sistema muestra: "¿Vincularlo al gasto existente o importar de nuevo?"

ESCENARIO B: Duplicado manual
1. Usuario importa CFDI (UUID1234...)
2. Más tarde, usuario captura gasto manualmente (OCR)
   - Mismo concepto, misma fecha, mismo monto
3. Sistema detecta: "¿Es el mismo gasto?"
   - Opción 1: Vincular (marcar OCR como "importado de CFDI")
   - Opción 2: Crear dos registros (si son diferentes)

VALIDACIONES:
├─ UUID CFDI único (no 2 gastos con mismo UUID)
├─ Monto + Fecha + RFC ≈ igual (buscar duplicados por similitud)
├─ RFC válido (13 caracteres SAT)
└─ Firma digital válida (verificar contra SAT)
```

---

## 🗄️ Schema de Base de Datos

### 1. Nueva tabla `cfdi_importados` (Audit Trail)

```sql
CREATE TABLE cfdi_importados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Identificación del CFDI
  uuid_cfdi VARCHAR(36) UNIQUE NOT NULL,     -- UUID formato SAT
  tipo_cfdi VARCHAR(20) NOT NULL,             -- "RECIBIDO" (GastoCheck) | "EMITIDO" (CobraCheck)
  
  -- Metadata XML
  xml_contenido BYTEA,                        -- XML completo (encriptado)
  xml_hash VARCHAR(64),                       -- SHA256 para detección duplicados
  
  -- Emisor/Receptor
  rfc_emisor VARCHAR(13) NOT NULL,
  nombre_emisor VARCHAR(255),
  rfc_receptor VARCHAR(13) NOT NULL,
  nombre_receptor VARCHAR(255),
  
  -- Datos financieros
  monto_total DECIMAL(15,2),
  fecha_emision DATE,
  fecha_vencimiento DATE,
  
  -- Validación SAT
  validado_sat BOOLEAN DEFAULT false,
  validacion_sat_timestamp TIMESTAMP,
  validacion_sat_resultado TEXT,              -- "VÁLIDO", "REVOCADO", "CANCELADO", "NO ENCONTRADO"
  
  -- Importación
  tipo_importacion VARCHAR(20),               -- "MANUAL" (usuario sube XML), "API" (futuro: SAT API)
  archivo_nombre VARCHAR(255),
  usuario_importador UUID REFERENCES usuarios(id),
  
  -- Referencia a registro creado
  gasto_id UUID REFERENCES gastos(id) SET NULL,              -- Si es GastoCheck
  factura_id UUID REFERENCES facturas(id) SET NULL,          -- Si es CobraCheck
  
  -- Estado
  estado VARCHAR(20) DEFAULT 'PENDIENTE',    -- "PENDIENTE", "PROCESADO", "DUPLICADO", "ERROR", "REVOCADO"
  mensaje_error TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Índices
CREATE INDEX idx_cfdi_uuid ON cfdi_importados(uuid_cfdi);
CREATE INDEX idx_cfdi_empresa ON cfdi_importados(empresa_id);
CREATE INDEX idx_cfdi_tipo ON cfdi_importados(tipo_cfdi);
CREATE INDEX idx_cfdi_estado ON cfdi_importados(estado);
CREATE UNIQUE INDEX idx_cfdi_hash ON cfdi_importados(xml_hash);
```

### 2. Extensiones a `gastos`

```sql
ALTER TABLE gastos ADD COLUMN cfdi_importado_id UUID 
  REFERENCES cfdi_importados(id) SET NULL;
  
ALTER TABLE gastos ADD COLUMN origen VARCHAR(20)
  DEFAULT 'OCR';  -- "OCR" (ticket), "CFDI" (XML), "MANUAL"

-- Índices
CREATE INDEX idx_gastos_cfdi ON gastos(cfdi_importado_id);
```

### 3. Extensiones a `facturas` (CobraCheck)

```sql
ALTER TABLE facturas ADD COLUMN cfdi_importado_id UUID 
  REFERENCES cfdi_importados(id) SET NULL;

ALTER TABLE facturas ADD COLUMN uuid_cfdi VARCHAR(36) UNIQUE;

ALTER TABLE facturas ADD COLUMN origen VARCHAR(20)
  DEFAULT 'MANUAL';  -- "MANUAL" (usuario ingresa), "CFDI" (XML importado)
```

---

## 🔌 Edge Functions Requeridas

### 1. `parse-cfdi-xml` (Extraer datos del XML)

**Trigger:** POST /api/cfdi/parse  
**Entrada:**
```json
{
  "xml_base64": "base64...",
  "tipo_cfdi": "RECIBIDO" | "EMITIDO"
}
```

**Lógica:**
```
1. Decodificar XML desde base64
2. Validar estructura XML (¿es CFDI válido?)
3. Extraer campos principales:
   ├─ UUID CFDI
   ├─ RFC Emisor / Receptor
   ├─ Nombres
   ├─ Monto
   ├─ Fecha
   ├─ Concepto/items
   ├─ Fecha vencimiento (si es factura)
   └─ Firma digital
4. Normalizar RFC (13 caracteres)
5. Retornar estructura ParsedCfdi
```

**Salida:**
```json
{
  "uuid_cfdi": "12345678-1234-1234-1234-123456789012",
  "tipo_cfdi": "RECIBIDO",
  "rfc_emisor": "PRV123456XYZ",
  "nombre_emisor": "Proveedor A, S.A.",
  "rfc_receptor": "EMP123456ABC",
  "nombre_receptor": "Mi Empresa, S.A.",
  "monto_total": 5000.00,
  "fecha_emision": "2026-06-15",
  "fecha_vencimiento": null,
  "subtotal": 4310.34,
  "iva": 689.66,
  "items": [
    {
      "descripcion": "Papel A4 - Resma",
      "cantidad": 10,
      "unitario": 150.00,
      "importe": 1500.00
    }
  ],
  "firmaDigital": "MIICQDC...",
  "certificado": "MIIEXDC...",
  "confianza_parseo": 0.98,
  "warnings": []
}
```

---

### 2. `import-cfdi` (Importar y crear gasto/factura)

**Trigger:** POST /api/cfdi/import  
**Entrada:**
```json
{
  "empresa_id": "UUID",
  "xml_base64": "base64...",
  "tipo_cfdi": "RECIBIDO" | "EMITIDO"
}
```

**Lógica:**

```
PASO 1: VALIDAR DUPLICADOS
├─ Calcular hash SHA256 del XML
├─ Buscar en cfdi_importados.xml_hash
├─ Si existe: Retornar error "Ya fue importado"
└─ Si no: Continuar

PASO 2: PARSEAR XML
├─ Llamar parse-cfdi-xml
├─ Extraer datos
└─ Si error: Guardar en cfdi_importados.estado = "ERROR"

PASO 3: VALIDAR SAT (Async, no bloquea)
├─ Verificar firma digital
├─ Llamar API SAT para validar UUID
│  └─ ¿CFDI vigente, revocado, cancelado?
├─ Guardar resultado en cfdi_importados.validacion_sat_resultado
└─ Si REVOCADO/CANCELADO: Marcar como "REVOCADO"

PASO 4: BUSCAR DUPLICADOS POR SIMILITUD
├─ Si RECIBIDO:
│  └─ Buscar en gastos:
│     WHERE empresa_id = X
│       AND rfc = parsedCfdi.rfc_emisor
│       AND monto ≈ parsedCfdi.monto (±0.01)
│       AND fecha = parsedCfdi.fecha
│       AND cfdi_importado_id IS NULL
│     → Si encontrado: Vincular a gasto existente
│     → Si no: Crear nuevo
│
├─ Si EMITIDO:
│  └─ Buscar en facturas:
│     WHERE empresa_id = X
│       AND cliente_id (por RFC = parsedCfdi.rfc_receptor)
│       AND monto = parsedCfdi.monto
│       AND fecha = parsedCfdi.fecha
│     → Si encontrado: Vincular a factura existente
│     → Si no: Crear nueva

PASO 5: CREAR REGISTRO (GastoCheck)
├─ Si RECIBIDO:
│  ├─ gastos.insert({
│  │   empresa_id: X,
│  │   proveedor: parsed.nombre_emisor,
│  │   rfc_proveedor: parsed.rfc_emisor,
│  │   monto: -parsed.monto_total,  -- Negativo
│  │   fecha: parsed.fecha_emision,
│  │   concepto: parsed.items[0].descripcion,
│  │   categoria: auto-detectedCategory,
│  │   origen: "CFDI",
│  │   cfdi_importado_id: cfdi.id
│  │ })
│  └─ Retornar gasto creado
│
├─ Si EMITIDO:
│  ├─ facturas.insert({
│  │   empresa_id: X,
│  │   cliente_id: (por RFC),
│  │   uuid_cfdi: parsed.uuid_cfdi,
│  │   monto: parsed.monto_total,
│  │   fecha: parsed.fecha_emision,
│  │   fecha_vencimiento: parsed.fecha_vencimiento,
│  │   concepto: parsed.items[0].descripcion,
│  │   origen: "CFDI",
│  │   cfdi_importado_id: cfdi.id
│  │ })
│  └─ Retornar factura creada

PASO 6: GUARDAR METADATA
├─ cfdi_importados.insert({
│   uuid_cfdi: parsed.uuid_cfdi,
│   tipo_cfdi: tipo,
│   xml_hash: sha256(xml),
│   ... más metadata
│   gasto_id o factura_id: (si se creó)
│   estado: "PROCESADO"
│ })
```

**Salida:**
```json
{
  "success": true,
  "cfdi_id": "UUID",
  "gasto_id": "UUID",  // Si RECIBIDO
  "factura_id": "UUID",  // Si EMITIDO
  "mensaje": "CFDI importado y gasto creado",
  "uuid_cfdi": "12345678...",
  "validacion_sat": "PENDIENTE"  // Se validará async
}
```

---

### 3. `validate-cfdi-sat` (Validación async)

**Trigger:** Scheduled (cada 6 horas) para CFDIs pendientes  
**Entrada:** Ninguna

**Lógica:**
```
1. Buscar cfdi_importados donde validado_sat = false
2. Para cada CFDI:
   ├─ Llamar API SAT (o verificar firma)
   ├─ Actualizar validacion_sat_resultado
   ├─ Si REVOCADO: Marcar estado = "REVOCADO"
   │  └─ Crear alerta: "CFDI revocado — revisar gasto/factura"
   └─ Si VÁLIDO: Marcar validado_sat = true
3. Registrar en logs
```

---

### 4. `detect-duplicate-cfdis` (Prevención de duplicados)

**Trigger:** Scheduled (diario) o Manual  
**Entrada:** Ninguna

**Lógica:**
```
1. Para cada empresa:
   ├─ Buscar gastos con cfdi_importado_id duplicados
   ├─ Buscar facturas con uuid_cfdi duplicados
   ├─ Buscar gastos similares (RFC + monto + fecha):
   │  └─ Si 2+ coinciden: Crear alerta "Posible duplicado"
   └─ Crear entrada en diferencias_caja si es necesario
```

---

## 🎨 UI Components

### Web (Next.js)

**Nueva página:**
```
apps/web/app/gastocheck/importar-cfdi/page.tsx
├─ [📎 Seleccionar archivo XML]
├─ [Preview de datos extraídos]
├─ [Validación: ¿Duplicado?]
├─ [Botón: Importar]
└─ Resultado: Gasto creado + Validación SAT

apps/web/app/cobracheck/importar-factura/page.tsx
├─ [📎 Seleccionar archivo XML]
├─ [Preview de datos extraídos]
├─ [Validación: ¿Duplicado?]
├─ [Botón: Importar]
└─ Resultado: Factura creada + Validación SAT
```

**Nuevos componentes:**
```
apps/web/components/
├─ CfdiUploadZone.tsx          # Drag & drop para XML
├─ CfdiParsePreview.tsx        # Mostrar datos extraídos
├─ DuplicateDetectionWarning.tsx  # Alertar si hay duplicados
├─ CfdiValidationStatus.tsx    # Estado SAT (validando, ✅, ⚠️)
└─ CfdiImportHistory.tsx       # Historial de importaciones
```

### Mobile (Expo)

```
apps/mobile/screens/
├─ ImportarCfdiScreen.tsx      # Upload simple en mobile
└─ ValidationStatus.tsx        # Ver estado de validación
```

---

## 🔐 Seguridad

### Almacenamiento de XML

```typescript
// NUNCA guardar XML en plain text
// SIEMPRE encriptado

async function encryptXml(xml: string) {
  const cipher = createCipher('aes-256-gcm', ENCRYPTION_KEY);
  const encrypted = cipher.update(xml, 'utf-8', 'hex') + cipher.final('hex');
  return encrypted;
}

// Guardar en BD:
cfdi_importados.xml_contenido = await encryptXml(xmlContent);
```

### Validación de Firma Digital

```typescript
// Verificar que CFDI está firmado correctamente
// No crear si la firma es inválida

function validateCfdiSignature(xml: string, certificado: string): boolean {
  const sax = require('xmldsigjs');
  // Verificar firma digital XMLDSIG
  return sax.verify(xml, certificado);
}
```

### RLS Policies

```sql
-- Usuario solo importa/ve CFDIs de su empresa
CREATE POLICY cfdi_by_empresa ON cfdi_importados
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM empresa_usuarios 
      WHERE usuario_id = auth.uid()
    )
  );
```

---

## 📊 Métricas de Éxito

```
✅ Usuarios pueden importar CFDI (GastoCheck + CobraCheck)
✅ Detección de duplicados: 100% (no importar 2 veces)
✅ Validación SAT: > 95% (verificar firma)
✅ RFC extraído correctamente: > 99%
✅ Monto extraído correctamente: > 99%
✅ Caja cuadra: 100% (todos los gastos/cobros capturados)
✅ Performance: Importar 50 CFDIs en < 5 seg
✅ 0 CFDIs revocados pasados por alto
```

---

## 📅 Cronograma Estimado

### Fase 1: Infrastructure (1-2 días)
- Crear tablas `cfdi_importados` + extensiones
- RLS policies
- Índices

### Fase 2: Core Functions (2-3 días)
- `parse-cfdi-xml` (1 día)
- `import-cfdi` (1 día)
- `validate-cfdi-sat` + `detect-duplicates` (0.5 día)

### Fase 3: Frontend (1-2 días)
- Upload components (Web)
- Preview + validation (Web + Mobile)
- Import history

### Fase 4: Testing (1 día)
- Testing con CFDIs reales
- Validación SAT
- Detección duplicados

**Total estimado: 5-8 días**

**CRÍTICO PARA OTA 1.0 + 1.1**
- GastoCheck OTA 1.0 NO COMPLETO sin CFDI recibidos
- CobraCheck OTA 1.1 NO COMPLETO sin CFDI emitidos

---

## ⚠️ Consideraciones Técnicas

### Validación SAT

**Opciones:**
1. **API oficial SAT** (si disponible)
   - Verificar UUID contra registros oficiales
   - Detectar revocados/cancelados
   
2. **Verificación de firma digital local**
   - Validar XMLDSIG contra certificado
   - No requiere conexión a SAT
   - Más rápido pero menos confiable

3. **Hybrid:** Validar firma localmente, verificar UUID async

**Recomendación:** Opción 3 (verificación local inmediata, SAT async)

### Parsing de XML CFDI

**Usar librería:** `xml2js` (NPM)
```typescript
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const cfdi = await parser.parseStringPromise(xmlContent);
```

**Estructura típica:**
```xml
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  Folio="123456"
  Fecha="2026-06-15T10:30:00"
  Total="5000.00"
  UUID="12345678-1234-1234-1234-123456789012">
  
  <cfdi:Emisor Rfc="PRV123456XYZ" Nombre="Proveedor A"/>
  <cfdi:Receptor Rfc="EMP123456ABC" Nombre="Mi Empresa"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Descripcion="Papel A4" CantidadItem="10" PrecioUnitario="150"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="689.66">
    <cfdi:Traslados>
      <cfdi:Traslado Base="4310.34" Impuesto="002" TasaOCuota="0.16"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>
```

---

## 🚀 Roadmap Futuro

### OTA 1.2: BancoCheck + CFDI Auto-Sync

```
Cuando usuario conecta banco (BancoCheck):
├─ Buscar movimientos sin gasto asociado
├─ Para cada movimiento:
│  └─ Buscar en SAT: ¿hay CFDI con este RFC + monto?
│  └─ Si encuentra: Importar automáticamente
│  └─ Resultado: Gasto aparece en GastoCheck
│           └─ Y se reconcilia con movimiento bancario
```

### OTA 1.4: FacturaCheck + CFDI Emitido Auto-Load

```
Cuando usuario emite factura en sistema:
├─ Automáticamente subir XML a SAT (si está conectado)
├─ Guardar UUID en BD
├─ Usuario puede ver: "Factura emitida: UUID12345... ✅"
```

---

## 📝 Checklist de Implementación

- [ ] Crear tabla `cfdi_importados`
- [ ] Extender `gastos` y `facturas`
- [ ] Edge Function `parse-cfdi-xml`
- [ ] Edge Function `import-cfdi`
- [ ] Edge Function `validate-cfdi-sat`
- [ ] Edge Function `detect-duplicate-cfdis`
- [ ] UI Upload CFDI (Web)
- [ ] UI Upload CFDI (Mobile)
- [ ] Testing con CFDIs reales
- [ ] Documentar para usuarios
- [ ] Validar no bloquea OTA 1.0 + 1.1

---

**Prioridad:** CRÍTICA para completar flujo de dinero en OTA 1.0 + 1.1
