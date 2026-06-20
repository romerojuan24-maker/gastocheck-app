# 🏗️ CHECK SUITE — Arquitectura Integral de Base de Datos

**Versión:** 2.0 (Replanteo estructural)  
**Fecha:** 2026-06-20  
**Concepto:** Una sola BD, múltiples módulos, cero duplicación

---

## 📋 Paradigma Fundamental

**Antes (MALO):**
```
GastoCheck → gastos table
CobraCheck → facturas + pagos tables
BancoCheck → banco_movimientos table
FacturaCheck → facturas table (duplicado)

❌ PROBLEMA: Datos duplicados, sincronización compleja, inconsistencias
```

**Ahora (CORRECTO):**
```
Una sola tabla central: movimientos_financieros
  ├─ Campo: tipo_movimiento (GASTO, INGRESO, PAGO, TRANSFERENCIA)
  ├─ Campo: modulo_origen (GASTOCHECK, COBRACHECK, BANCOCHECK, etc)
  ├─ Campo: estado (REGISTRADO, PAGADO, RECONCILIADO)
  ├─ Referencia: gasto_id (si vino de GastoCheck)
  ├─ Referencia: factura_id (si vino de CobraCheck)
  ├─ Referencia: banco_movimiento_id (si está en banco)
  ├─ Referencia: cfdi_id (si vino de XML)
  └─ Auditoría completa

Cada módulo es solo una VISTA de la misma data:
  ├─ GastoCheck: Ve movimientos donde tipo = GASTO
  ├─ CobraCheck: Ve movimientos donde tipo = INGRESO + FACTURA
  ├─ BancoCheck: Ve movimientos donde tipo = CUALQUIERA
  └─ Reconciliación: Vincula las referencias (gasto + banco = pagado)

✅ BENEFICIO: Una sola fuente de verdad, sincronización automática
```

---

## 🗄️ Schema Integral Propuesto

### Tabla Central: `movimientos_financieros`

```sql
CREATE TABLE movimientos_financieros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- IDENTIFICACIÓN
  numero_movimiento BIGINT,                   -- Secuencia por empresa (1, 2, 3...)
  uuid_externo VARCHAR(36),                   -- Para CFDI o banco
  
  -- TIPO Y CATEGORÍA
  tipo_movimiento VARCHAR(20) NOT NULL,       -- GASTO, INGRESO, PAGO_PENDIENTE, REEMBOLSO
  subtipo VARCHAR(50),                        -- "COMPRA_LOCAL", "TRANSFERENCIA", "DEPOSITO_CLIENTE"
  categoria VARCHAR(50),                      -- Auto-categorizado (IA)
  
  -- MONTO
  monto DECIMAL(15,2) NOT NULL,               -- Positivo o negativo
  moneda VARCHAR(3) DEFAULT 'MXN',
  
  -- PARTES INVOLUCRADAS
  rfc_otra_parte VARCHAR(13),                 -- RFC del proveedor/cliente
  nombre_otra_parte VARCHAR(255),
  cuenta_bancaria_otra_parte VARCHAR(50),
  
  -- FECHAS
  fecha_evento DATE NOT NULL,                 -- Cuándo sucedió
  fecha_registro TIMESTAMP DEFAULT now(),    -- Cuándo se registró
  fecha_pago DATE,                            -- Cuándo se pagó (si es GASTO)
  fecha_vencimiento DATE,                     -- Vencimiento (si es FACTURA)
  
  -- DESCRIPCIÓN
  concepto VARCHAR(255),                      -- Qué es
  descripcion TEXT,
  
  -- ESTADO DEL CICLO DE DINERO
  estado_registro VARCHAR(20),                -- BORRADOR, REGISTRADO, CANCELADO
  estado_pago VARCHAR(20),                    -- PENDIENTE, PAGADO, PARCIAL, VENCIDO, REEMBOLSADO
  estado_impuesto VARCHAR(20),                -- PENDIENTE, PAGADO, FACTURADO, DEVUELTO
  estado_contable VARCHAR(20),                -- PENDIENTE_PÓLIZA, PÓLIZA_CREADA, ENVIADO_SAT
  
  -- REFERENCIAS CRUZADAS (El corazón del sistema integral)
  gasto_id UUID REFERENCES gastos(id) SET NULL,
  factura_id UUID REFERENCES facturas(id) SET NULL,
  pago_id UUID REFERENCES pagos(id) SET NULL,
  banco_movimiento_id UUID REFERENCES banco_movimientos(id) SET NULL,
  cfdi_id UUID REFERENCES cfdi_importados(id) SET NULL,
  poliza_id UUID REFERENCES polizas(id) SET NULL,
  
  -- RECONCILIACIÓN
  es_reconciliado BOOLEAN DEFAULT false,
  fecha_reconciliacion TIMESTAMP,
  reconciliado_con UUID REFERENCES movimientos_financieros(id) SET NULL,
  
  -- AUDITORÍA
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMP DEFAULT now(),
  modificado_por UUID REFERENCES usuarios(id),
  modificado_en TIMESTAMP,
  
  -- FLAGS
  es_duplicado BOOLEAN DEFAULT false,         -- ¿Es duplicado de otro?
  requiere_revision BOOLEAN DEFAULT false,    -- Baja confianza OCR/parsing
  trazabilidad_completa BOOLEAN DEFAULT false, -- ¿Tenemos gasto + pago + banco?
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Índices
CREATE INDEX idx_mov_empresa ON movimientos_financieros(empresa_id);
CREATE INDEX idx_mov_tipo ON movimientos_financieros(tipo_movimiento);
CREATE INDEX idx_mov_estado_pago ON movimientos_financieros(estado_pago);
CREATE INDEX idx_mov_fecha ON movimientos_financieros(fecha_evento);
CREATE INDEX idx_mov_rfc ON movimientos_financieros(rfc_otra_parte);
CREATE UNIQUE INDEX idx_mov_numero ON movimientos_financieros(empresa_id, numero_movimiento);

-- RLS
ALTER TABLE movimientos_financieros ENABLE ROW LEVEL SECURITY;
CREATE POLICY mov_by_empresa ON movimientos_financieros
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM empresa_usuarios 
      WHERE usuario_id = auth.uid()
    )
  );
```

---

## 🔄 Cómo Funciona la Integración

### Caso 1: GastoCheck - De OCR a Pago en Banco

```
PASO 1: Usuario captura ticket con OCR
  ↓
INSERT movimientos_financieros {
  empresa_id: X,
  tipo_movimiento: "GASTO",
  monto: -2500,
  fecha_evento: 2026-06-15,
  concepto: "Compra papel",
  rfc_otra_parte: "PRV123456XYZ",
  nombre_otra_parte: "Proveedor A",
  estado_registro: "REGISTRADO",
  estado_pago: "PENDIENTE",
  creado_por: usuario_id
}
  ↓ (Retorna movimiento_id)
  ↓
INSERT gastos {
  movimiento_id: X,  ← VÍNCULO
  empresa_id: Y,
  monto: -2500,
  fecha: 2026-06-15,
  concepto: "Compra papel",
  origen: "OCR"
}
  ↓
User ve en GastoCheck:
  [💰 Compra papel] [Estado: PENDIENTE] [Monto: $2,500]

PASO 2: Usuario paga transferencia a Proveedor A
  ↓
BancoCheck detecta egreso de $2,500 el 2026-06-17
  ↓
Sistema reconcilia:
  SELECT movimientos_financieros WHERE
    rfc_otra_parte = "PRV123456XYZ"
    AND monto = -2500
    AND estado_pago = "PENDIENTE"
  ↓ (Encuentra el movimiento del PASO 1)
  ↓
UPDATE movimientos_financieros SET
  estado_pago = "PAGADO",
  banco_movimiento_id = banco_mov_id,
  fecha_pago = 2026-06-17,
  es_reconciliado = true,
  trazabilidad_completa = true
  ↓
User ve:
  [💰 Compra papel] [Estado: ✅ PAGADO] [Pago en banco: 17/6]

PASO 3: Sistema crea póliza automática
  ↓
INSERT polizas {
    movimiento_financiero_id: X,  ← VÍNCULO
    ... datos contables
  }
  ↓
UPDATE movimientos_financieros SET
  estado_contable = "PÓLIZA_CREADA",
  poliza_id = Y
```

### Caso 2: CobraCheck - De Factura a Depósito en Banco

```
PASO 1: Usuario registra cliente y crea factura
  ↓
INSERT movimientos_financieros {
  empresa_id: X,
  tipo_movimiento: "INGRESO",
  subtipo: "FACTURA_CLIENTE",
  monto: 10000,
  fecha_evento: 2026-06-15,
  fecha_vencimiento: 2026-06-25,
  concepto: "Servicios profesionales",
  rfc_otra_parte: "CLT456789ABC",
  nombre_otra_parte: "Cliente B",
  estado_registro: "REGISTRADO",
  estado_pago: "PENDIENTE",
  estado_impuesto: "PENDIENTE_FACTURA"
}
  ↓ (Retorna movimiento_id)
  ↓
INSERT facturas {
  movimiento_id: X,  ← VÍNCULO
  empresa_id: Y,
  cliente_id: Z,
  monto: 10000,
  fecha: 2026-06-15,
  vencimiento: 2026-06-25,
  origen: "MANUAL"
}
  ↓
User ve en CobraCheck:
  [📞 Cliente B] [Servicios profesionales] [Estado: PENDIENTE] [Vence: 25/6]

PASO 2: Usuario importa CFDI emitido del SAT
  ↓
Sistema detecta: Es el mismo movimiento (mismo cliente, monto, fecha)
  ↓
UPDATE movimientos_financieros SET
  cfdi_id = cfdi_uuid,
  uuid_externo = "12345678-1234-1234-1234-123456789012",
  estado_impuesto = "FACTURADO"
  ↓
User ve:
  [📞 Cliente B] [UUID: 12345678...] [✅ Facturado]

PASO 3: Cliente B hace depósito en banco
  ↓
BancoCheck detecta ingreso de $10,000 el 2026-06-20
  ↓
Sistema reconcilia:
  SELECT movimientos_financieros WHERE
    rfc_otra_parte = "CLT456789ABC"
    AND monto = 10000
    AND estado_pago = "PENDIENTE"
  ↓ (Encuentra el movimiento del PASO 1)
  ↓
UPDATE movimientos_financieros SET
  estado_pago = "PAGADO",
  banco_movimiento_id = banco_mov_id,
  fecha_pago = 2026-06-20,
  es_reconciliado = true,
  trazabilidad_completa = true
  ↓
User ve:
  [📞 Cliente B] [Estado: ✅ PAGADO] [Recibido: 20/6]

PASO 4: Sistema crea póliza automática
  ↓
INSERT polizas {
  movimiento_financiero_id: X,  ← VÍNCULO
  ... datos contables
}
```

### Caso 3: BancoCheck - Vista Integral de TODO

```
Usuario abre BancoCheck dashboard:
  ↓
Query movimientos_financieros DONDE
  es_reconciliado = true
  ↓
SELECT {
  monto,
  fecha_evento,
  concepto,
  estado_pago,
  rfc_otra_parte,
  
  -- Trazabilidad completa:
  IF gasto_id IS NOT NULL → "Gasto: [OCR] → [Pagado]"
  IF factura_id IS NOT NULL → "Factura: [Cliente] → [Pagado]"
  IF banco_movimiento_id IS NOT NULL → "Banco: [Movimiento]"
  IF cfdi_id IS NOT NULL → "CFDI: [SAT]"
  IF poliza_id IS NOT NULL → "Póliza: [Contable]"
}
  ↓
Dashboard muestra:
  
  EGRESOS:
  ├─ 15/6 | Compra papel (OCR → Banco → Póliza) | $2,500 | ✅ PAGADO
  ├─ 18/6 | Servicios (CFDI recibido) | $3,000 | ⏳ SIN PAGAR
  └─ Total egresos: $5,500
  
  INGRESOS:
  ├─ 15/6 | Cliente B (Factura → Banco → Póliza) | $10,000 | ✅ PAGADO
  ├─ 20/6 | Depósito anónimo | $1,500 | ⚠️ SIN ASIGNAR
  └─ Total ingresos: $11,500
  
  CAJA:
  ├─ Saldo inicio: $100,000
  ├─ Movimientos reconciliados: $17,000
  ├─ Movimientos sin pagar: $3,000
  └─ Saldo actual: $110,000 ✅ CUADRA
```

---

## 📊 Flujos de Datos (Integrados)

### 1. Un movimiento puede tener múltiples referencias

```
Un movimiento financiero = un evento de dinero

Ejemplo: Compra a Proveedor A por $2,500

movimientos_financieros[UUID123] {
  id: UUID123,
  tipo_movimiento: "GASTO",
  monto: -2500,
  rfc_otra_parte: "PRV123456XYZ"
}

↓ Cuando usuario captura con OCR:
gastos[GASTO001] {
  movimiento_id: UUID123,  ← Referencia
  ... datos OCR
}

↓ Cuando usuario sube CFDI del proveedor:
cfdi_importados[CFDI001] {
  movimiento_id: UUID123,  ← Misma referencia
  ... datos XML
}

↓ Cuando banco paga:
banco_movimientos[BANCO001] {
  movimiento_id: UUID123,  ← Misma referencia
  ... datos banco
}

↓ Sistema crea póliza:
polizas[POL001] {
  movimiento_id: UUID123,  ← Misma referencia
  ... datos contables
}

RESULTADO: Un solo "evento de dinero" que se ve desde 4 ángulos
```

### 2. Reconciliación automática por referencia

```
Cuando llega dinero al banco:
  SELECT movimientos_financieros WHERE
    rfc_otra_parte = banco_movimiento.rfc
    AND monto = banco_movimiento.monto
    AND estado_pago = "PENDIENTE"
  ↓
Si encuentra: UPDATE movimientos_financieros
  SET banco_movimiento_id = ..., estado_pago = "PAGADO"
  
  → Automáticamente actualiza:
    ├─ gastos (si existe)
    ├─ facturas (si existe)
    ├─ cfdi_importados (si existe)
    └─ polizas (si existe)
    
  Todo porque apunta al MISMO movimiento_financiero
```

### 3. Cascada de estados

```
Un movimiento tiene 4 dimensiones de estado:

movimientos_financieros {
  estado_registro: "REGISTRADO" / "CANCELADO"
    ↓ (¿Existe el registro?)
    
  estado_pago: "PENDIENTE" / "PAGADO" / "PARCIAL"
    ↓ (¿Se pagó/cobró?)
    
  estado_impuesto: "PENDIENTE_FACTURA" / "FACTURADO" / "DEVUELTO"
    ↓ (¿Está en SAT?)
    
  estado_contable: "PENDIENTE_PÓLIZA" / "PÓLIZA_CREADA" / "ENVIADO_SAT"
    ↓ (¿Está en contabilidad?)
}

FLUJO COMPLETO:
REGISTRADO → PAGADO → FACTURADO → PÓLIZA_CREADA

Si falta algo: estado_pago = "PENDIENTE" (señala qué falta)
```

---

## 💾 Tablas Simplificadas (Solo Referencias)

### `gastos` - Vista de GastoCheck

```sql
CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id UUID NOT NULL REFERENCES movimientos_financieros(id),
  empresa_id UUID NOT NULL,
  
  -- Datos específicos de GastoCheck
  proveedor_id UUID REFERENCES proveedores(id),
  categoria_gasto VARCHAR(50),
  
  -- OCR metadata
  ocr_confidence VARCHAR(20),
  ocr_warnings TEXT,
  
  -- Auditoría
  origen VARCHAR(20),                  -- "OCR", "CFDI", "MANUAL", "IMPORTADO"
  ocr_image_url VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT now()
};

-- Nota: MONTO, FECHA, ESTADO, RFC, NOMBRE, etc.
-- están en movimientos_financieros (tabla central)
```

### `facturas` - Vista de CobraCheck

```sql
CREATE TABLE facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id UUID NOT NULL REFERENCES movimientos_financieros(id),
  empresa_id UUID NOT NULL,
  
  -- Datos específicos de CobraCheck
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  numero_factura VARCHAR(50),
  
  -- CFDI
  uuid_cfdi VARCHAR(36),
  cfdi_url VARCHAR(255),
  
  -- Auditoría
  origen VARCHAR(20),                  -- "MANUAL", "CFDI_IMPORTADO"
  
  created_at TIMESTAMP DEFAULT now()
};

-- Nota: MONTO, FECHA, ESTADO, RFC, VENCIMIENTO, etc.
-- están en movimientos_financieros (tabla central)
```

### `pagos` - Registros de Pago (Referencia)

```sql
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id UUID NOT NULL REFERENCES movimientos_financieros(id),
  
  -- Datos de pago específico
  metodo_pago VARCHAR(30),             -- "TRANSFERENCIA", "TARJETA", "EFECTIVO"
  referencia_pago VARCHAR(100),        -- Número de transferencia
  
  created_at TIMESTAMP DEFAULT now()
};

-- Nota: El resto en movimientos_financieros
```

---

## 🎯 Beneficios de Esta Arquitectura

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Sincronización** | Manual (error-prone) | Automática (1 tabla central) |
| **Duplicados** | Posibles (datos repetidos) | Imposibles (UUID único) |
| **Reconciliación** | Compleja (3+ queries) | Simple (1 UPDATE) |
| **Caja cuadra** | Difícil (datos desalineados) | Garantizado (fuente única) |
| **Auditoría** | Dispersa (múltiples tablas) | Centralizada (1 tabla) |
| **Performance** | 20+ joins | 5-10 joins |
| **Mantenimiento** | Cambios en múltiples lugares | Cambios en 1 lugar |
| **CFDI integration** | Complicada (mapeo manual) | Natural (misma tabla) |
| **BancoCheck** | Necesita lógica especial | Consulta estándar |
| **Nuevos módulos** | Requieren nuevas tablas | Solo nuevas VISTAS |

---

## 🚀 Implementación

### Fase 1: Crear movimientos_financieros (1 día)

```
1. Crear tabla central
2. Backfill datos existentes:
   - gastos → movimientos_financieros
   - facturas → movimientos_financieros
   - banco_movimientos → movimientos_financieros
3. Actualizar relaciones (foreign keys)
4. Testing
```

### Fase 2: Actualizar módulos (2-3 días)

```
1. GastoCheck:
   - Insertar movimientos_financieros al capturar OCR
   - Vincular gasto_id
   
2. CobraCheck:
   - Insertar movimientos_financieros al crear factura
   - Vincular factura_id
   
3. BancoCheck:
   - Insertar banco_movimiento_id en movimientos_financieros
   - Buscar coincidencias por rfc + monto + fecha
   - Reconciliación automática
   
4. CFDI Import:
   - Insertar movimientos_financieros al importar XML
   - Vincular cfdi_id
   - Detectar duplicados (UUID único)
```

### Fase 3: Pólizas (1 día)

```
1. Al marcar movimiento como estado_pago = "PAGADO":
   - Si estado_contable = "PENDIENTE_PÓLIZA"
   - Crear póliza automáticamente
   - Vincular poliza_id
```

---

## 📋 Checklist

- [ ] Crear tabla `movimientos_financieros`
- [ ] Backfill datos existentes
- [ ] Actualizar foreign keys en `gastos`, `facturas`, etc.
- [ ] Crear índices de performance
- [ ] RLS policies
- [ ] Testing (migración de datos)
- [ ] Actualizar Edge Functions para usar tabla central
- [ ] Actualizar UI (si es necesario)
- [ ] Documentar para equipo

---

## 🔄 Verdad Fundamental

**Cada módulo = una VISTA diferente de la MISMA data**

```
movimientos_financieros (tabla central, fuente única de verdad)
  ├─ GastoCheck: SELECT WHERE tipo_movimiento = "GASTO"
  ├─ CobraCheck: SELECT WHERE tipo_movimiento IN ("INGRESO", "FACTURA")
  ├─ BancoCheck: SELECT WHERE es_reconciliado = true
  ├─ SAT: SELECT WHERE cfdi_id IS NOT NULL
  └─ Contabilidad: SELECT WHERE poliza_id IS NOT NULL

Cambio en 1 movimiento → Automáticamente visible en todos los módulos
```

---

**Esto es la verdadera integración. Un sistema, una BD, múltiples interfaces.**
