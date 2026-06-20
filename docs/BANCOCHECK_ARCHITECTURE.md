# 🏦 BancoCheck — Arquitectura OTA 1.2

**Versión:** 1.0  
**Fecha:** 2026-06-20  
**Estado:** Diseño (listo para implementación)  

---

## 📋 Resumen Ejecutivo

**Objetivo:** Conciliar bancos automáticamente vía Open Banking + PDF + Cross-validation inteligente con GastoCheck/CobraCheck.

**Alcance OTA 1.2:**
- **Opción 1 - Open Banking:** Conexión directa a bancos (Plaid) para sync automático
- **Opción 2 - PDF:** Upload de estado de cuenta (OCR automático, como GastoCheck)
- **Cross-validation cascada:**
  - GastoCheck → ¿Pagué este gasto? (egresos = gastos)
  - CobraCheck → ¿Recibí de este cliente? (ingresos = pagos registrados)
  - Detectar discrepancias y auditar diferencias
- **Caja esperada vs real:** Saldo teórico vs banco
- **Dashboard unificado:** Flujo de efectivo + reconciliación pendiente
- **Alertas inteligentes:** "Falta reconciliar $X", "Diferencia detectada: $Y"

**Beneficio:**
- Máxima reconciliación automática (sin captura manual)
- Sabe exactamente: qué gastos pagaron, qué cobros llegaron
- Detecta fraude/errores: diferencias banco vs registros
- Caja siempre cuadrada y auditada

---

## 🏗️ Arquitectura Técnica

### Stack

```
Frontend:     Next.js 15 + Expo 54 (compartido con GastoCheck)
Backend:      Edge Functions (Supabase) — Reutilizar existentes
Database:     PostgreSQL (Supabase)
OCR:          Gemini 1.5 Flash (IGUAL que GastoCheck) ✅
Open Banking: Plaid API (conexión directa)
Auth:         Supabase + OAuth2
Payments:     Stripe (no aplica en OTA 1.2)
```

### Reutilización de OCR (CLAVE)

**Situación actual:**
- ✅ `ocr-extract` Edge Function: Probado en producción (GastoCheck)
- ✅ Usa Gemini 1.5 Flash con JSON schema validation
- ✅ Parseo robusto (3 estrategias de fallback)
- ✅ Normalización de RFC, UUID, montos
- ✅ Confianza: high/medium/low + warnings

**Para BancoCheck:**
1. **NO duplicar código** — reutilizar `ocr-extract` 
2. **Crear Edge Function `extract-bank-statement`**:
   - Mismo mecanismo que `ocr-extract`
   - Prompt diferente (extrae TABLA de estado de cuenta)
   - Retorna array de movimientos (fecha, concepto, monto, saldo)
3. **Compartir lógica en `packages/shared`**:
   - `OcrEngine` clase genérica
   - Prompts por tipo de documento
   - Parseo robusto centralizado

**Prompts reutilizables:**
```typescript
const OCR_PROMPTS = {
  TICKET: "Eres experto en tickets...",  // Ya en ocr-extract
  BANK_STATEMENT: "Eres experto en estados de cuenta...",  // NUEVO
  INVOICE: "Eres experto en facturas...",  // Para OTA 1.4 (FacturaCheck)
};
```

### Decisión: ¿Qué proveedor Open Banking?

**Recomendación:** Plaid (estándar, escalable, mantenible)
- Soporta 9000+ bancos a nivel global
- APIs documentadas y confiables
- Mejor que alternativas (Fintoc limitado, BBVA/Citibanamex complejos)

---

## 🗄️ Schema de Base de Datos

### Nuevas Tablas

#### 1. `banco_cuentas` (Bank Accounts)

```sql
CREATE TABLE banco_cuentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Identificación
  nombre VARCHAR(100) NOT NULL,        -- "BBVA Cheques", "Citibanamex Ahorros"
  numero_cuenta VARCHAR(50) NOT NULL,  -- 1234567890
  tipo_cuenta VARCHAR(20),              -- "CHEQUES", "AHORROS", "CRÉDITO"
  
  -- Banco
  banco_codigo VARCHAR(3),              -- SAT code (002=Banamex, 012=BBVA, etc)
  banco_nombre VARCHAR(100),
  
  -- Plaid/Open Banking
  plaid_item_id VARCHAR(100) UNIQUE,    -- Token de Plaid
  plaid_access_token VARCHAR(255),      -- Encriptado en app
  plaid_account_id VARCHAR(100),        -- ID de cuenta en Plaid
  
  -- Saldo
  saldo_actual DECIMAL(15,2),           -- Último saldo conocido
  saldo_fecha TIMESTAMP,                -- Cuándo se obtuvo
  saldo_disponible DECIMAL(15,2),       -- Disponible para gastar
  
  -- Sincronización
  ultima_sincronizacion TIMESTAMP,
  proxima_sincronizacion TIMESTAMP,
  estado_sincronizacion VARCHAR(20),    -- "ACTIVO", "PENDIENTE", "ERROR"
  
  -- Metadata
  activo BOOLEAN DEFAULT true,
  moneda VARCHAR(3) DEFAULT 'MXN',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS: Usuarios ven solo cuentas de su empresa
ALTER TABLE banco_cuentas ENABLE ROW LEVEL SECURITY;
CREATE POLICY banco_cuentas_by_empresa ON banco_cuentas
  FOR ALL USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios 
    WHERE usuario_id = auth.uid()
  ));
```

#### 2. `banco_movimientos` (Bank Transactions)

```sql
CREATE TABLE banco_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_cuenta_id UUID NOT NULL REFERENCES banco_cuentas(id) ON DELETE CASCADE,
  
  -- Información del movimiento
  plaid_transaction_id VARCHAR(100) UNIQUE,  -- ID único de Plaid
  fecha DATE NOT NULL,
  fecha_registro TIMESTAMP,                   -- Cuándo se sincronizó
  
  -- Datos
  concepto VARCHAR(255),                      -- "Pago BBVA", "Depósito cliente"
  monto DECIMAL(15,2) NOT NULL,               -- Positivo=ingreso, Negativo=egreso
  tipo VARCHAR(20),                           -- "INGRESO", "EGRESO"
  
  -- Categorización automática (de Plaid)
  categoria_plaid VARCHAR(100),               -- "TRANSFER", "PAYMENT", "DEPOSIT"
  subcategoria VARCHAR(100),
  
  -- Reconciliación
  gasto_id UUID REFERENCES gastos(id),        -- ¿Qué gasto coincide?
  estado_reconciliacion VARCHAR(20),          -- "NO_ASIGNADO", "ASIGNADO", "REVISADO"
  confianza_match DECIMAL(3,2),               -- 0.00 - 1.00 (qué tan seguro es match)
  
  -- Metadata
  saldo_despues DECIMAL(15,2),                -- Saldo después de este movimiento
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS: A través de banco_cuentas
ALTER TABLE banco_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY banco_movimientos_by_empresa ON banco_movimientos
  FOR ALL USING (banco_cuenta_id IN (
    SELECT id FROM banco_cuentas 
    WHERE empresa_id IN (
      SELECT empresa_id FROM empresa_usuarios 
      WHERE usuario_id = auth.uid()
    )
  ));
```

#### 3. `alertas_saldo` (Balance Alerts)

```sql
CREATE TABLE alertas_saldo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_cuenta_id UUID NOT NULL REFERENCES banco_cuentas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Configuración
  umbral_minimo DECIMAL(15,2),                -- Alertar si saldo < esto
  alertar_cuando VARCHAR(20),                 -- "DEBAJO", "ARRIBA"
  
  -- Historial
  ultima_alerta TIMESTAMP,
  activo BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE alertas_saldo ENABLE ROW LEVEL SECURITY;
CREATE POLICY alertas_saldo_by_empresa ON alertas_saldo
  FOR ALL USING (empresa_id IN (
    SELECT empresa_id FROM empresa_usuarios 
    WHERE usuario_id = auth.uid()
  ));
```

#### 4. `flujo_efectivo_diario` (Daily Cash Flow)

```sql
CREATE TABLE flujo_efectivo_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_cuenta_id UUID NOT NULL REFERENCES banco_cuentas(id),
  empresa_id UUID NOT NULL,
  
  fecha DATE NOT NULL,
  
  -- Flujo REAL (del banco)
  saldo_inicial DECIMAL(15,2),
  ingresos_reales DECIMAL(15,2),
  egresos_reales DECIMAL(15,2),
  saldo_final_real DECIMAL(15,2),
  
  -- Flujo ESPERADO (teórico)
  saldo_esperado_inicial DECIMAL(15,2),
  ingresos_esperados DECIMAL(15,2),
  egresos_esperados DECIMAL(15,2),
  saldo_esperado_final DECIMAL(15,2),
  
  -- Diferencia
  diferencia DECIMAL(15,2),                -- real - esperado
  diferencia_porcentaje DECIMAL(5,2),
  
  -- Análisis
  cambio_neto DECIMAL(15,2),
  dias_caja_disponible INT,
  tendencia VARCHAR(20),                   -- AUMENTANDO, DISMINUYENDO, ESTABLE
  
  reconciliados_porciento DECIMAL(3,0),   -- % del día reconciliado
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_flujo_fecha ON flujo_efectivo_diario(fecha);
CREATE INDEX idx_flujo_cuenta ON flujo_efectivo_diario(banco_cuenta_id);
```

#### 5. `reconciliaciones_cruzadas` (Cross-validation Audit Trail)

```sql
CREATE TABLE reconciliaciones_cruzadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  banco_movimiento_id UUID NOT NULL REFERENCES banco_movimientos(id),
  
  -- Matcheo automático
  tipo_match VARCHAR(20),                  -- "GASTO", "PAGO_CLIENTE", "INGRESO_OTRO", "SIN_MATCH"
  
  -- Referencia cruzada (puede ser null si sin_match)
  gasto_id UUID REFERENCES gastos(id),                    -- Si es GASTO
  pago_id UUID REFERENCES pagos(id),                      -- Si es PAGO_CLIENTE (CobraCheck)
  cliente_id UUID REFERENCES clientes(id),                -- Si es INGRESO de cliente
  
  -- Score de confianza
  confianza DECIMAL(3,2),                 -- 0.00 (sin coincidencia) - 1.00 (exacto)
  razon_match TEXT,                       -- "Monto exacto + fecha ±1 día + categoría"
  
  -- Estado
  estado VARCHAR(20),                     -- "AUTO_ASIGNADO", "REVISADO", "MANUAL", "RECHAZADO"
  revisado_por UUID REFERENCES usuarios(id),
  revisado_en TIMESTAMP,
  
  -- Auditoría
  diferencia_monto DECIMAL(15,2),         -- Si no coincide exacto
  diferencia_dias INT,                    -- Diferencia de fechas
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_recon_movimiento ON reconciliaciones_cruzadas(banco_movimiento_id);
CREATE INDEX idx_recon_gasto ON reconciliaciones_cruzadas(gasto_id);
CREATE INDEX idx_recon_pago ON reconciliaciones_cruzadas(pago_id);
```

#### 6. `diferencias_caja` (Cash Discrepancies - Alertas)

```sql
CREATE TABLE diferencias_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  banco_cuenta_id UUID NOT NULL REFERENCES banco_cuentas(id),
  
  fecha_deteccion DATE,
  
  -- Qué falta/sobra
  tipo_diferencia VARCHAR(20),            -- "MOVIMIENTO_FALTANTE", "GASTO_SIN_PAGO", "INGRESO_NO_REPORTADO"
  monto DECIMAL(15,2),
  descripcion TEXT,
  
  -- Movimiento asociado (si aplica)
  banco_movimiento_id UUID REFERENCES banco_movimientos(id),
  gasto_id UUID REFERENCES gastos(id),
  pago_id UUID REFERENCES pagos(id),
  
  -- Estado
  estado VARCHAR(20),                     -- "DETECTADO", "INVESTIGANDO", "RESUELTO", "FALSO_POSITIVO"
  resolucion TEXT,
  resuelto_por UUID REFERENCES usuarios(id),
  resuelto_en TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT now()
);
```

#### 7. `extraccion_pdf_estado` (PDF Extraction - OCR)

```sql
CREATE TABLE extraccion_pdf_estado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_cuenta_id UUID NOT NULL REFERENCES banco_cuentas(id),
  
  -- PDF metadata
  pdf_url VARCHAR(255),
  nombre_archivo VARCHAR(255),
  fecha_estado DATE,                      -- Mes que cubre el estado
  
  -- Extracción OCR
  saldo_inicial DECIMAL(15,2),
  saldo_final DECIMAL(15,2),
  movimientos_extraidos INT,              -- Cuántos movimientos OCR encontró
  
  -- Procesamiento
  status VARCHAR(20),                     -- "SUBIDO", "EXTRAYENDO", "COMPLETADO", "ERROR"
  confianza_ocr DECIMAL(3,2),             -- % de confianza de OCR
  
  errores_ocr TEXT,                       -- Si falló
  
  created_at TIMESTAMP DEFAULT now()
);

-- Documentación: Cada OCR de PDF crea banco_movimientos automáticamente
```

### Cambios a Tablas Existentes

#### `gastos` (Expand)

```sql
ALTER TABLE gastos ADD COLUMN banco_movimiento_id UUID 
  REFERENCES banco_movimientos(id) SET NULL;
  
-- Índice para búsqueda rápida
CREATE INDEX idx_gastos_movimiento ON gastos(banco_movimiento_id);

-- Trigger: Cuando se asigna un movimiento, marcar como reconciliado
CREATE TRIGGER marcar_gasto_reconciliado
AFTER UPDATE OF banco_movimiento_id ON gastos
FOR EACH ROW
WHEN (NEW.banco_movimiento_id IS NOT NULL)
EXECUTE FUNCTION actualizar_timestamp_updated();
```

#### `empresas` (Expand)

```sql
ALTER TABLE empresas ADD COLUMN 
  banco_configurado BOOLEAN DEFAULT false;
```

---

## 🔄 Flujos de Usuario

### Flujo 1a: Conectar Banco (Open Banking - Plaid)

```
Usuario (Web)
  ↓
[Configuración > Conectar Banco]
  ↓
[Opción 1: USAR API (Plaid) O Opción 2: SUBIR PDF]
  ↓
[Plaid Link > OAuth]
  ↓
Usuario ingresa credenciales en Plaid
  ↓
Plaid devuelve `access_token` + metadata
  ↓
Frontend → Edge Function `connect-bank-account`
  ↓
Edge Function:
  1. Guardar access_token encriptado en BD
  2. Fetch primeros movimientos (últimos 90 días)
  3. Insertar en banco_movimientos
  4. EJECUTAR CASCADA DE RECONCILIACIÓN CRUZADA
  5. Crear entrada en banco_cuentas
  6. Retornar éxito
  ↓
Usuario ve: "✅ Banco conectado. 150 movimientos sincronizados. 127 reconciliados automáticamente."
```

### Flujo 1b: Conectar Banco (PDF - Sin API)

```
Usuario (Web)
  ↓
[Configuración > Conectar Banco]
  ↓
[Opción 2: SUBIR ESTADO DE CUENTA PDF]
  ↓
Usuario sube PDF de estado
  ↓
Frontend → Edge Function `extract-pdf-statement`
  ↓
Edge Function:
  1. Usar OCR (Claude Vision, como GastoCheck)
  2. Extraer movimientos del PDF:
     - Fecha
     - Concepto
     - Monto
     - Saldo
  3. Insertar en banco_movimientos
  4. EJECUTAR CASCADA DE RECONCILIACIÓN CRUZADA
  5. Guardar metadata de extracción (confianza OCR, errores)
  ↓
Si OCR confidence > 90%: Auto-procesar
Si OCR confidence < 90%: Mostrar preview para usuario valide
  ↓
Usuario ve: "✅ Estado de cuenta cargado. 45 movimientos importados. 40 reconciliados automáticamente. 5 requieren revisión."
```

### Flujo 2: Reconciliación Cruzada Automática (CASCADA)

```
Se ejecuta cuando:
- Banco obtiene nuevos movimientos (Plaid o PDF)
- Usuario registra nuevo gasto (GastoCheck)
- Usuario registra nuevo pago (CobraCheck)

CASCADA DE BÚSQUEDA:
================

Si movimiento es EGRESO (salida):
  ↓
  1. Buscar en gastos:
     WHERE empresa_id = X
       AND ABS(monto - gasto.monto) < 0.01
       AND ABS(fecha - gasto.fecha) <= 1 día
       AND banco_movimiento_id IS NULL
     → Si encontrado: MATCH = "GASTO" (confianza 0.95)
  
  2. Si no encontrado: marcar como "SIN_MATCH" (confianza 0.00)
     → Crear alerta: "Egreso sin gasto registrado: $X el Y"

Si movimiento es INGRESO (entrada):
  ↓
  1. Buscar en pagos (CobraCheck):
     WHERE empresa_id = X
       AND cliente_id = Z
       AND ABS(monto - pago.monto) < 0.01
       AND ABS(fecha - pago.fecha) <= 1 día
       AND banco_movimiento_id IS NULL
     → Si encontrado: MATCH = "PAGO_CLIENTE" (confianza 0.95)
  
  2. Si no encontrado: buscar por monto cercano en pagos
     → MATCH = "PAGO_CLIENTE" (confianza 0.70)
     → Mostrar opciones al usuario
  
  3. Si aún no encontrado: marcar como "SIN_MATCH"
     → Crear alerta: "Ingreso sin pago registrado: $X del Y"

CREAR ENTRADA EN reconciliaciones_cruzadas:
  - banco_movimiento_id: UUID
  - tipo_match: "GASTO" | "PAGO_CLIENTE" | "SIN_MATCH"
  - gasto_id / pago_id: ref cruzada
  - confianza: score automático
  - estado: "AUTO_ASIGNADO" si confianza > 0.90, sino "REVISADO"
  
ACTUALIZAR flujo_efectivo_diario:
  - Calcular saldo_esperado basado en gastos + pagos registrados
  - Comparar vs saldo_real del banco
  - Detectar diferencia (caja no cuadra)
  
ALERTAS INTELIGENTES:
  - Si diferencia > $100: "⚠️ Caja descuadra $X"
  - Si hay ingresos sin match: "📬 $X recibido, ¿de quién?"
  - Si hay egresos sin match: "💸 $X salió, ¿qué gasto fue?"

AUDITAR EN diferencias_caja:
  - Si reconciliación_porciento < 100%: crear entrada
  - Rastrear qué quedó sin reconciliar y por qué
```

### Flujo 3: Sincronización Automática Continua

```
Scheduled Job (cada 6 horas) o Webhook de Plaid
  ↓
Edge Function `sync-bank-accounts`
  ↓
Para cada banco_cuenta con método = "PLAID":
  1. Llamar Plaid con access_token
  2. Fetch nuevos movimientos
  3. EJECUTAR CASCADA DE RECONCILIACIÓN (ver arriba)
  4. Actualizar flujo_efectivo_diario
  5. Crear alertas si hay diferencias
  ↓
Resultado: Sistema siempre tiene caja sincronizada
```

### Flujo 3: Ver Flujo de Efectivo

```
Usuario (Web o Mobile)
  ↓
[Dashboard > Flujo de Efectivo]
  ↓
Frontend fetch:
  GET /api/flujo-efectivo?banco_cuenta_id=X&fecha_inicio=Y&fecha_fin=Z
  ↓
Edge Function `get-cash-flow`
  1. Query flujo_efectivo_diario
  2. Agrupar por fecha
  3. Retornar array [{fecha, ingresos, egresos, saldo_final}, ...]
  ↓
Frontend renderiza:
  - Gráfico: Saldo por día (línea)
  - Tabla: Ingresos/Egresos/Neto por día
  - KPI: Saldo actual, Ingresos mes, Egresos mes
  ↓
Usuario ve proyección: "Con este ritmo, efectivo dura 45 días"
```

### Flujo 4: Reconciliar Manualmente

```
Usuario (Web)
  ↓
[Banco > Movimientos Sincronizados]
  ↓
Ve lista de movimientos sin asignar:
  - "15 JUN | $5,000 | Depósito cliente"
  - "16 JUN | -$2,500 | Pago BBVA"
  ↓
Usuario selecciona movimiento
  ↓
[Asociar a Gasto]
  ↓
Sistema muestra gastos sin asignar cercanos en fecha/monto
  ↓
Usuario elige: "16 JUN | -$2,500 | Compra papel"
  ↓
Frontend POST /api/reconcile-transaction
  {
    movimiento_id: UUID,
    gasto_id: UUID
  }
  ↓
Edge Function actualiza:
  - gastos.banco_movimiento_id = movimiento_id
  - banco_movimientos.estado_reconciliacion = "ASIGNADO"
  ↓
Usuario ve: "✅ Movimiento asociado"
```

---

## 🔌 Edge Functions Requeridas

### 0. `reconcile-movement-cascade` (NÚCLEO - Llamado por otros)

**NO ES UN ENDPOINT** — Función auxiliar llamada por otros endpoints

**Lógica:** (Pseudocódigo)
```typescript
async function reconcileMovementCascade(
  movimiento: BancoMovimiento,
  empresaId: UUID
) {
  let match = null;
  let confianza = 0;
  let tipo = "SIN_MATCH";
  
  if (movimiento.tipo === "EGRESO") {
    // Buscar en gastos
    const gasto = await db
      .from('gastos')
      .select('*')
      .eq('empresa_id', empresaId)
      .filter('monto', 'eq', -movimiento.monto) // Gasto es negativo
      .filter('fecha', 'gte', movimiento.fecha - 1 day)
      .filter('fecha', 'lte', movimiento.fecha + 1 day)
      .is('banco_movimiento_id', null)
      .limit(1)
      .single();
    
    if (gasto) {
      match = { type: 'gasto', id: gasto.id };
      confianza = 0.95; // Coincidencia exacta
      tipo = "GASTO";
    }
  } else if (movimiento.tipo === "INGRESO") {
    // Buscar en pagos (CobraCheck)
    const pago = await db
      .from('pagos')
      .select('*, clientes!inner(nombre)')
      .eq('empresa_id', empresaId)
      .filter('monto', 'eq', movimiento.monto)
      .filter('fecha_pago', 'gte', movimiento.fecha - 1 day)
      .filter('fecha_pago', 'lte', movimiento.fecha + 1 day)
      .is('banco_movimiento_id', null)
      .limit(1)
      .single();
    
    if (pago) {
      match = { type: 'pago', id: pago.id, cliente_id: pago.cliente_id };
      confianza = 0.95;
      tipo = "PAGO_CLIENTE";
    }
  }
  
  // Crear entrada de reconciliación
  await db.from('reconciliaciones_cruzadas').insert({
    banco_movimiento_id: movimiento.id,
    tipo_match: tipo,
    gasto_id: match?.type === 'gasto' ? match.id : null,
    pago_id: match?.type === 'pago' ? match.id : null,
    cliente_id: match?.cliente_id || null,
    confianza: confianza,
    estado: confianza > 0.90 ? 'AUTO_ASIGNADO' : 'REVISADO',
  });
  
  // Crear alertas si no hay match
  if (tipo === "SIN_MATCH") {
    await createCajaDifference({
      empresa_id: empresaId,
      banco_movimiento_id: movimiento.id,
      tipo: movimiento.tipo === "EGRESO" 
        ? "GASTO_SIN_PAGO"
        : "INGRESO_NO_REPORTADO",
      monto: movimiento.monto,
      descripcion: movimiento.concepto,
    });
  }
  
  return { match, confianza, tipo };
}
```

---

### 1. `connect-bank-account` (Plaid)

**Trigger:** POST /api/banks/connect  
**Entrada:**
```json
{
  "public_token": "public_XXXXX",
  "metadata": { "institution": {...}, "account": {...} }
}
```

**Lógica:**
1. Intercambiar `public_token` por `access_token` (Plaid API)
2. Guardar `access_token` encriptado en BD
3. Fetch primeros 90 días de transacciones
4. Insertar en `banco_movimientos`
5. **Para cada movimiento:** Ejecutar `reconcileMovementCascade()`
6. Recalcular `flujo_efectivo_diario`
7. Retornar resumen

**Salida:**
```json
{
  "success": true,
  "banco_cuenta_id": "UUID",
  "movimientos_cargados": 150,
  "movimientos_reconciliados": 127,
  "movimientos_sin_match": 23,
  "saldo": 125000.00
}
```

---

### 1b. `extract-bank-statement` (OCR - PDF + REUTILIZAR)

**Trigger:** POST /api/banks/upload-pdf  
**Entrada:**
```json
{
  "empresa_id": "UUID",
  "pdf_pages_base64": ["base64_page1", "base64_page2", ...],
  "nombre_archivo": "estado_bbva_junio_2026.pdf",
  "banco_codigo": "012"  // BBVA
}
```

**Arquitectura:**
```
Extract Bank Statement (NEW Edge Function)
  ↓
[Para cada página del PDF]
  ↓
Usar rutina OCR existente (Gemini 1.5 Flash)
  ├─ Pero con PROMPT DIFERENTE:
  │  └─ "Extrae tabla de movimientos: fecha | concepto | monto | saldo"
  │
  ├─ REUTILIZAR:
  │  ├─ JSON schema validation (de ocr-extract)
  │  ├─ Parseo robusto (3 estrategias fallback)
  │  ├─ Normalización de montos
  │  └─ Manejo de confianza (high/medium/low)
  │
  └─ Retorna: Array de OcrBankMovement
    
    interface OcrBankMovement {
      fecha: string;           // YYYY-MM-DD
      concepto: string;
      monto: number;           // Positivo = ingreso, negativo = egreso
      saldo: number;           // Saldo después
      referencia?: string;
      confidence: 'high' | 'medium' | 'low';
      warnings: string[];
    }

Procesar resultados:
  ↓
1. Combinar todas las páginas en un array de movimientos
2. Validar que sean cronológicos (no repetidos)
3. Crear entradas en `banco_movimientos`
4. Ejecutar cascada de reconciliación
5. Guardar metadata (confianza OCR, errores)
```

**Lógica:**
1. Guardar PDF en Supabase Storage
2. Convertir PDF a imágenes (PDF2Image)
3. **Para cada página:**
   - Enviar a Gemini Vision (MISMO `ocr-extract`, prompt diferente)
   - Extraer tabla de movimientos
   - Normalizar fechas y montos
   - Aplicar confianza
4. Fusionar páginas (eliminar duplicados temporales)
5. Crear entradas en `banco_movimientos`
6. **Para cada movimiento:** Ejecutar `reconcileMovementCascade()`
7. Si confianza < 85%: Mostrar preview para usuario valide
8. Recalcular `flujo_efectivo_diario`

**Salida:**
```json
{
  "success": true,
  "movimientos_extraidos": 45,
  "movimientos_reconciliados": 40,
  "movimientos_sin_match": 5,
  "confianza_promedio_ocr": 0.92,
  "requiere_revision": false,
  "paginas_procesadas": 2,
  "periodo": "Junio 2026",
  "saldo_inicial": 100000,
  "saldo_final": 110500,
  "diferencia_validacion": 0  // Si cuadra con saldo del banco
}
```

**Ventaja: Cero duplicación**
- Usa la MISMA infraestructura que GastoCheck
- MISMO motor Gemini
- MISMO parseo robusto
- Solo cambia el PROMPT
- Mantenimiento centralizado en `ocr-extract`

---

### 2. `sync-bank-accounts` (Sincronización Automática)

**Trigger:** Scheduled (cada 6 horas)  
**Entrada:** Ninguna

**Lógica:**
1. Listar todas las `banco_cuentas` activas con método = "PLAID"
2. Para cada una:
   - Llamar Plaid API
   - Fetch movimientos desde `ultima_sincronizacion`
   - Insertar en `banco_movimientos`
   - **Para cada movimiento nuevo:** `reconcileMovementCascade()`
3. Recalcular `flujo_efectivo_diario` para todas las cuentas
4. Revisar `diferencias_caja` y crear alertas
5. Actualizar `ultima_sincronizacion`

**Salida:**
```json
{
  "exito": true,
  "cuentas_sincronizadas": 3,
  "movimientos_nuevos": 45,
  "movimientos_reconciliados": 40,
  "movimientos_sin_match": 5,
  "diferencias_detectadas": 2,
  "timestamp": "2026-06-20T14:30:00Z"
}
```

---

### 3. `get-cash-flow`

**Trigger:** GET /api/cash-flow?banco_cuenta_id=X&dias=90

**Lógica:**
1. Query `flujo_efectivo_diario` para el rango
2. Si falta data reciente, calcularla on-the-fly
3. Retornar array con proyección

**Salida:**
```json
{
  "cuenta": { "id": "UUID", "nombre": "BBVA Cheques" },
  "flujo": [
    {
      "fecha": "2026-06-20",
      "saldo_inicial": 100000,
      "ingresos": 20000,
      "egresos": 5000,
      "saldo_final": 115000
    },
    // ... más días
  ],
  "resumenes": {
    "saldo_actual": 115000,
    "ingresos_mes": 150000,
    "egresos_mes": 50000,
    "dias_caja": 45,  // Con ritmo actual
    "tendencia": "ESTABLE"
  }
}
```

---

### 4. `reconcile-transaction`

**Trigger:** POST /api/transactions/reconcile  
**Entrada:**
```json
{
  "movimiento_id": "UUID",
  "gasto_id": "UUID"
}
```

**Lógica:**
1. Validar que ambas IDs pertenecen a la empresa del user
2. Actualizar `gastos.banco_movimiento_id`
3. Actualizar `banco_movimientos.estado_reconciliacion = "ASIGNADO"`
4. Trigger: recalcular flujo_efectivo_diario

**Salida:**
```json
{
  "success": true,
  "message": "Transacción reconciliada"
}
```

---

### 5. `get-cash-box-reconciliation` (Caja Esperada vs Real)

**Trigger:** GET /api/cash-flow/reconciliation?banco_cuenta_id=X&fecha=YYYY-MM-DD

**Lógica:**
```
CAJA ESPERADA (teórica):
  Saldo inicio: $100,000
  + Gastos registrados pagados: -$25,000
  + Pagos de clientes registrados: +$35,000
  = Saldo esperado: $110,000

CAJA REAL (del banco):
  Según estado de cuenta: $110,500

DIFERENCIA:
  Real - Esperado = $500
  → ¿Qué falta reconciliar?

ANÁLISIS:
1. Buscar movimientos sin match en banco
2. Buscar gastos sin payment en GastoCheck
3. Buscar pagos sin verificación en CobraCheck
4. Mostrar lista de "cosas que no cuadran"
```

**Salida:**
```json
{
  "saldo_esperado": 110000,
  "saldo_real": 110500,
  "diferencia": 500,
  "caja_cuadra": false,
  
  "egresos_registrados_sin_confirmar": [
    {
      "gasto_id": "UUID",
      "monto": 2500,
      "fecha": "2026-06-15",
      "concepto": "Compra papel",
      "estado": "REGISTRADO PERO NO PAGADO EN BANCO"
    }
  ],
  
  "ingresos_en_banco_sin_registrar": [
    {
      "movimiento_id": "UUID",
      "monto": 5000,
      "fecha": "2026-06-16",
      "concepto": "Depósito cliente",
      "posible_cliente": "Cliente X",  // si lo detectó
      "estado": "RECIBIDO PERO NO REGISTRADO"
    }
  ],
  
  "reconciliacion_porciento": 87,
  "recomendacion": "Revisar 5 movimientos pendientes para cuadrar caja"
}
```

---

### 6. `export-cash-flow`

**Trigger:** GET /api/cash-flow/export?banco_cuenta_id=X&formato=excel&fecha_inicio=Y&fecha_fin=Z

**Lógica:**
1. Query flujo_efectivo_diario + reconciliaciones_cruzadas
2. Generar reporte con:
   - Saldos diarios (real vs esperado)
   - Movimientos (con qué se reconciliaron)
   - Diferencias detectadas
3. Retornar archivo (Excel con 3 sheets)

**Salida:** 
```
Sheet 1: Flujo Diario
├─ Fecha | Saldo Inicial | Ingresos | Egresos | Saldo Final | % Reconciliado

Sheet 2: Movimientos
├─ Fecha | Concepto | Monto | Match | Tipo | Confianza

Sheet 3: Alertas
├─ Fecha | Diferencia | Tipo | Monto | Estado
```

---

## 🎨 UI/Components

### Web (Next.js)

**Nuevas páginas:**
```
apps/web/app/bancocheck/
├─ page.tsx                    # Dashboard principal
├─ conectar-banco/page.tsx     # Onboarding
├─ mis-cuentas/page.tsx        # Gestión de cuentas
├─ flujo-efectivo/page.tsx     # Gráficos y proyección
└─ movimientos/page.tsx        # Historial + reconciliación
```

**Nuevos componentes:**
```
apps/web/components/
├─ BancosConectados.tsx        # Cards de cuentas
├─ PlaidLink.tsx               # Botón conectar (Plaid SDK)
├─ CashFlowChart.tsx           # Gráfico línea (Chart.js o Recharts)
├─ MovimientosTable.tsx        # Tabla de transacciones
├─ ReconciliationModal.tsx     # Modal asignar movimiento
├─ AlertasBalanceConfig.tsx    # Configurar alertas
└─ CashFlowProjection.tsx      # "Caja dura X días"
```

### Mobile (Expo)

**Nuevas screens:**
```
apps/mobile/screens/
├─ BancoCheckDashboard.tsx     # Saldo actual + últimos movimientos
├─ CashFlowScreen.tsx          # Gráfico simplificado
└─ AlertasScreen.tsx           # Notificaciones de saldo bajo
```

**Nuevos botones:**
```
Sidebar:
  💰 GastoCheck
  📞 CobraCheck
  🏦 BancoCheck ← NUEVO
  
BancoCheck tab:
  [💾 Saldo actual: $125,500]
  [📈 Flujo de hoy: +$15,000]
  [🔔 1 alerta]
```

---

## ✅ Validaciones

### Validación de Cuenta Bancaria

```typescript
interface BancoCuenta {
  nombre: string;           // Min 3, max 100
  numero_cuenta: string;    // Debe ser numérico, 10-18 dígitos
  tipo_cuenta: string;      // Enum: CHEQUES | AHORROS | CRÉDITO
  banco_codigo: string;     // SAT code válido (2 o 3 dígitos)
  umbral_alerta?: number;   // Positivo
}

// Validar número de cuenta (SAT estándar)
const isValidCuenta = (num: string) => {
  // Cuenta de cheques: 18 dígitos (Banco + Sucursal + Cuenta)
  // Cuenta de ahorros: 10-18 dígitos
  return /^\d{10,18}$/.test(num);
};
```

### Validación de Reconciliación

```typescript
// Antes de marcar movimiento como reconciliado:
// 1. Monto debe coincidir exactamente
// 2. Fecha debe estar dentro de ±1 día
// 3. Gasto no puede estar ya asignado
// 4. Tipo de movimiento debe coincidir (EGRESO = gasto negativo)

const canReconcile = (movimiento, gasto) => {
  const fechaDiff = Math.abs(
    new Date(movimiento.fecha) - new Date(gasto.fecha)
  ) / (1000 * 3600 * 24);
  
  return (
    Math.abs(movimiento.monto - gasto.monto) < 0.01 &&
    fechaDiff <= 1 &&
    !gasto.banco_movimiento_id &&
    (movimiento.tipo === 'EGRESO' && gasto.monto < 0)
  );
};
```

---

## 🔐 Seguridad

### Manejo de Access Tokens

```typescript
// NUNCA guardar access_token en plain text
// 1. Encriptar con clave de Supabase:

const encryptToken = async (token: string) => {
  const encrypted = await crypto.subtle.encrypt(
    'AES-GCM',
    key,  // De environment
    new TextEncoder().encode(token)
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};

// 2. Guardar solo versión encriptada en BD
// 3. Decrypt solo cuando necesites llamar a Plaid
// 4. NUNCA enviar token al cliente
```

### RLS Policies

```sql
-- Usuario solo ve cuentas bancarias de su empresa
CREATE POLICY banco_cuentas_isolation ON banco_cuentas
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM empresa_usuarios 
      WHERE usuario_id = auth.uid()
    )
  );

-- Usuario solo ve movimientos de sus cuentas
CREATE POLICY banco_movimientos_isolation ON banco_movimientos
  FOR ALL USING (
    banco_cuenta_id IN (
      SELECT id FROM banco_cuentas
      WHERE empresa_id IN (
        SELECT empresa_id FROM empresa_usuarios
        WHERE usuario_id = auth.uid()
      )
    )
  );
```

### Validación de Permisos

```typescript
// Edge Function debe validar:
// 1. Usuario autenticado
// 2. Banco_cuenta_id pertenece a empresa del usuario
// 3. Usuario tiene rol que permite leer datos bancarios
//    (Admin, Supervisor; NO Capturista)

const validateBancoAccess = async (userId, bancoId) => {
  const { data, error } = await supabase
    .from('banco_cuentas')
    .select('empresa_id')
    .eq('id', bancoId)
    .single();
  
  if (error || !data) return false;
  
  // Validar que usuario pertenece a esa empresa
  const hasAccess = await checkUserCompanyAccess(userId, data.empresa_id);
  return hasAccess;
};
```

---

## 🎯 ¿QUÉ VALIDACIONES CRUZADAS TENEMOS?

### GastoCheck ↔ BancoCheck

```
PREGUNTA: ¿Pagué este gasto?

Cuando llega un EGRESO del banco:
├─ Buscar en gastos por:
│  ├─ Monto exacto
│  ├─ Fecha ± 1 día
│  └─ Estado = "PENDIENTE" o "REGISTRADO"
├─ Si match: 
│  ├─ Marcar gasto como "PAGADO" ✅
│  ├─ Guardar referencia banco_movimiento_id
│  └─ Auditar quién pagó (timestamp, usuario)
├─ Si NO match:
│  ├─ Crear alerta "EGRESO SIN GASTO"
│  ├─ Monto: $X
│  └─ ¿Es un pago que olvidaste registrar?

CASOS:
- Gasto registrado el 15/6, pagado el 17/6 → MATCH ✅
- Gasto registrado el 16/6 por $2,500, egreso 16/6 por $2,500 → MATCH ✅
- Egreso 20/6 por $5,000 sin gasto → ALERTA
```

### CobraCheck ↔ BancoCheck

```
PREGUNTA: ¿Recibí este pago de cliente?

Cuando llega un INGRESO del banco:
├─ Buscar en pagos/clientes por:
│  ├─ Monto exacto
│  ├─ Fecha ± 1-2 días (a veces tarda)
│  └─ Cliente potencial (por monto previsto)
├─ Si match EXACTO: 
│  ├─ Marcar pago como "CONFIRMADO" ✅
│  ├─ Guardar referencia banco_movimiento_id
│  ├─ Auditar timestamp, usuario
│  └─ Crear póliza contable automática
├─ Si match PARCIAL (monto cercano, fecha aproximada):
│  ├─ Mostrar opciones al usuario
│  ├─ "¿Es pago de Cliente X por $4,950?"
│  └─ Usuario confirma manualmente
├─ Si NO match:
│  ├─ Crear alerta "INGRESO SIN CLIENTE"
│  ├─ Monto: $Y
│  ├─ Mostrar clientes que podrían estar pagando
│  └─ ¿De quién es este depósito?

CASOS:
- Pago registrado 16/6 por $5,000, depósito 17/6 por $5,000 → MATCH ✅
- Pago registrado Cliente X por $10,000, depósito 18/6 por $10,000 → MATCH ✅
- Depósito 20/6 por $8,500 sin cliente → ALERTA: "¿Es Cliente Y? Debe $8,000"
```

### GastoCheck ↔ CobraCheck ↔ BancoCheck (Triple validación)

```
FLUJO COMPLETO:

1. Usuario registra gasto por pagar a PROVEEDOR A:
   gastos.insert({
     empresa_id: X,
     concepto: "Compra papel",
     monto: -2500,
     fecha: 2026-06-15,
     proveedor: "Proveedor A"
   })

2. Usuario registra pago a PROVEEDOR A:
   Manualmente hace transferencia bancaria
   BancoCheck detecta: EGRESO $2,500 en banco el 17/6
   
3. Sistema reconcilia automáticamente:
   ├─ ¿Hay gasto $2,500? SÍ ✅
   ├─ Fecha 15/6 vs 17/6? SÍ (±2 días) ✅
   └─ RESULTADO: AUTO-MATCH con confianza 0.95
   
4. Usuario registra cliente B para cobrar:
   clientes.insert({
     empresa_id: X,
     nombre: "Cliente B",
     rfc: "ABC123456XYZ",
     credito_disponible: 50000,
     pago_esperado: 15000
   })
   
5. Usuario registra factura a Cliente B:
   facturas.insert({
     cliente_id: Y,
     monto: 15000,
     fecha_vencimiento: 2026-06-25
   })
   
6. Cliente B hace depósito en banco:
   BancoCheck detecta: INGRESO $15,000 en banco el 24/6
   
7. Sistema reconcilia automáticamente:
   ├─ ¿Hay cliente con pago pendiente? SÍ (Cliente B) ✅
   ├─ Monto $15,000? SÍ ✅
   ├─ Fecha dentro de plazo? SÍ (24/6, vencimiento 25/6) ✅
   └─ RESULTADO: AUTO-MATCH con confianza 0.98
   
8. Sistema crea póliza automática:
   polizas.insert({
     empresa_id: X,
     tipo: "INGRESO",
     lineas: [
       { cuenta: "BANCO", debit: 15000 },
       { cuenta: "CLIENTE B", credit: 15000 }
     ]
   })

RESULTADO FINAL:
✅ Gasto pagado → confirmado en banco
✅ Pago recibido → confirmado en banco
✅ Póliza generada → lista para CONTPAQi
✅ CAJA CUADRA 100%
```

---

## ❓ ¿QUÉ MÁS TE FALTARÍA?

Después de tener estas 3 validaciones cruzadas, podrías agregar:

### 1. **Detectar Fraude / Descrepancias Anómalas**
```
- Depósito que no coincide con ningún cliente esperado
  → "Ingreso anómalo: $X de origen desconocido"
  
- Egreso múltiple del mismo monto en corto tiempo
  → "¿Duplicado? 2 egresos de $2,500 en 3 horas"
  
- Movimiento a cuenta sospechosa (cambios frecuentes)
  → "Alerta: Movimiento a nueva cuenta"
```

### 2. **Proyección de Caja (Flujo Proyectado)**
```
Basado en:
  - Gastos recurrentes (cada mes)
  - Clientes recurrentes (pagos esperados)
  - Tendencia histórica (ingresos/egresos por período)

Calcular:
  - "Con ritmo actual, caja dura X días"
  - "Se espera ingreso de $Y en próximos 7 días"
  - "Próximos egresos: $Z"
```

### 3. **Reportes Contables Integrados**
```
- Conciliación bancaria (Banco vs Registros)
- Cartera vencida (clientes que no pagaron)
- Disponibilidad de caja (hoy vs próximos 30 días)
- Análisis de gastos por categoría vs ingresos
```

### 4. **Efectivo (Caja Física)**
```
Si usan efectivo además de banco:
  - gastos_efectivo table (egresos en caja física)
  - Reconciliar: Caja física + Banco = Total teórico
  - Alertas si falta efectivo (faltante de caja)
```

### 5. **Integración Contable**
```
Ya tienes polizas (GastoCheck + CobraCheck):
  - Agregar pólizas de BancoCheck
  - Exportar todo a CONTPAQi, FolioX, etc.
  - Validación SAT (si aplica)
```

### 6. **Alertas Inteligentes**
```
✅ Ya tienes: "Saldo bajo"
Podrías agregar:
  - "Caja no cuadra: falta reconciliar $X"
  - "Próximo cliente vence en 3 días"
  - "Próximo pago debe salir en 5 días"
  - "Ingreso anómalo detectado"
  - "Gasto duplicado sospechado"
```

### 7. **Dashboard Ejecutivo**
```
KPIs principales:
  ┌─────────────────────────────────┐
  │ 💰 Caja disponible: $125,500    │
  │ ✅ Caja cuadra: 100%             │
  │ 📈 Ingresos (mes): $150,000     │
  │ 📉 Egresos (mes): $100,000      │
  │ 🔔 Pendientes: 5 movimientos    │
  │ ⚠️ Clientes vencidos: $25,000   │
  └─────────────────────────────────┘
  
  Gráficos:
  - Flujo diario (línea)
  - Gastos vs Ingresos (barras)
  - Top clientes por monto
  - Tendencia próximos 30 días
```
```

---

## 📊 Métricas de Éxito (OTA 1.2)

```
✅ Usuarios pueden conectar banco (Plaid o PDF)
✅ Sincronización automática cada 6 horas
✅ Reconciliación cruzada: > 85% de movimientos
  ├─ GastoCheck match: > 80% de egresos
  └─ CobraCheck match: > 90% de ingresos
✅ Caja cuadra automáticamente
✅ Flujo de efectivo se actualiza en < 30 segundos
✅ Alertas de discrepancias llegan en < 5 minutos
✅ PDF de estado de cuenta se procesa en < 2 min
✅ 0 bugs críticos en vivo
✅ UI responsive (móvil + web)
✅ Performance: Dashboard carga en < 2 seg
```

---

## 📅 Cronograma Estimado

### Fase 1: Configuración (1-2 días)
- Crear cuenta Plaid
- Configurar webhook
- Generar API keys
- Setup en .env

### Fase 2: Base de Datos (1 día)
- Crear tablas
- Índices
- RLS policies
- Triggers

### Fase 3: Edge Functions (2-3 días)
- `connect-bank-account` (1 día)
- `sync-bank-accounts` (1 día)
- `get-cash-flow` + `reconcile` + `export` (1 día)

### Fase 4: Frontend (2-3 días)
- Componentes Web (1.5 días)
- Componentes Mobile (0.5 días)
- Testing + integración (1 día)

### Fase 5: Testing (1-2 días)
- Testing manual (1 día)
- QA checklist (0.5 días)
- Security review (0.5 días)

**Total estimado: 7-11 días de desarrollo**

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigation |
|--------|--------|-----------|
| Plaid API down | Alto | Fallback a sincronización manual; alertar usuario |
| Access token expire | Alto | Refresh automático; notificar usuario si falla |
| Reconciliación falsa | Medio | Confianza_match score; revisión manual disponible |
| Performance (muchos movimientos) | Medio | Paginación en tabla; query optimizado |
| Seguridad access_token | Crítico | Encriptación AES-GCM; audit log |
| Latencia Plaid (1000+ transacciones) | Medio | Batch processing; async jobs |

---

## 🚀 Próximos Pasos

1. ✅ **Este documento:** Aprobación de arquitectura
2. **Crear issue en GitHub** con checklist de implementación
3. **Setup Plaid account** y obtener credentials
4. **Comenzar Fase 1** (config + BD)
5. **Integración progresiva** (Edge Functions → UI)
6. **Testing exhaustivo** antes de OTA 1.2

---

## 📞 Referencias

- [Plaid API Docs](https://plaid.com/docs/)
- [Plaid Link (Web)](https://plaid.com/docs/link/web/)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [NextJS Edge Functions](https://vercel.com/docs/functions/edge-functions)

---

**Documento creado:** 2026-06-20  
**Versión:** 1.0  
**Estado:** 🟡 Revisión y aprobación
