# ⚡ HOY (Viernes 20 Junio) — Arquitectura Integral Sprint

**Objetivo:** Arquitectura integral LISTA y BLOQUEADA (no cambios después)

**Timeline:** Viernes 20, 09:00 - 17:00

---

## 🎯 Misión Crítica

**NO empezar OTA 1.0 mañana sin arquitectura LISTA**

Si arquitectura está a medias:
- OTA 1.0: Usa schema V1
- OTA 1.2 BancoCheck: Requiere refactor (schema V2)
- Pesadilla de backfill + downtime

**Solución:** Hoy hacemos arquitectura FINAL, mañana OTA 1.0 la usa.

---

## 📋 Tareas por Equipo (Hoy)

### EQUIPO A: Arquitectura Base (Daniel + 1 dev)

**Tarea 1: Schema movimientos_financieros FINAL (2 horas)**

- [ ] Revisar ARCHITECTURE_INTEGRAL_DATABASE.md completamente
- [ ] Tabla `movimientos_financieros`:
  ```sql
  CREATE TABLE movimientos_financieros (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    tipo_movimiento VARCHAR(20),      -- GASTO, INGRESO, PAGO_PENDIENTE
    monto DECIMAL(15,2),
    fecha_evento DATE,
    estado_pago VARCHAR(20),          -- PENDIENTE, PAGADO, PARCIAL
    estado_registro VARCHAR(20),      -- REGISTRADO, CANCELADO
    estado_contable VARCHAR(20),      -- PENDIENTE_PÓLIZA, PÓLIZA_CREADA
    estado_impuesto VARCHAR(20),      -- PENDIENTE, FACTURADO
    
    -- REFERENCIAS CRUZADAS (críticas)
    gasto_id UUID REFERENCES gastos(id),
    factura_id UUID REFERENCES facturas(id),
    pago_id UUID REFERENCES pagos(id),
    banco_movimiento_id UUID REFERENCES banco_movimientos(id),
    cfdi_id UUID REFERENCES cfdi_importados(id),
    poliza_id UUID REFERENCES polizas(id),
    
    -- Reconciliación
    es_reconciliado BOOLEAN DEFAULT false,
    reconciliado_con UUID REFERENCES movimientos_financieros(id),
    
    rfc_otra_parte VARCHAR(13),
    nombre_otra_parte VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
  );
  ```

- [ ] Índices FINALES:
  ```sql
  CREATE INDEX idx_mov_empresa ON movimientos_financieros(empresa_id);
  CREATE INDEX idx_mov_tipo ON movimientos_financieros(tipo_movimiento);
  CREATE INDEX idx_mov_estado_pago ON movimientos_financieros(estado_pago);
  CREATE INDEX idx_mov_fecha ON movimientos_financieros(fecha_evento);
  CREATE INDEX idx_mov_rfc ON movimientos_financieros(rfc_otra_parte);
  CREATE UNIQUE INDEX idx_mov_numero ON movimientos_financieros(empresa_id, numero_movimiento);
  ```

- [ ] RLS FINAL:
  ```sql
  ALTER TABLE movimientos_financieros ENABLE ROW LEVEL SECURITY;
  CREATE POLICY mov_by_empresa ON movimientos_financieros
    FOR ALL USING (
      empresa_id IN (
        SELECT empresa_id FROM empresa_usuarios 
        WHERE usuario_id = auth.uid()
      )
    );
  ```

- [ ] **MILESTONE:** Schema creada y testeada en BD ✅

---

**Tarea 2: Backfill Plan DETALLADO (1 hora)**

- [ ] Crear script SQL de backfill:
  ```
  PASO 1: Insertar movimientos desde gastos actuales
    FOR EACH gasto:
      INSERT INTO movimientos_financieros (
        empresa_id, tipo_movimiento='GASTO', monto=gasto.monto*-1,
        fecha_evento=gasto.fecha, gasto_id=gasto.id, ...
      ) RETURNING id as mov_id
      UPDATE gastos SET movimiento_id=mov_id WHERE id=gasto.id
  
  PASO 2: Insertar movimientos desde facturas actuales
    FOR EACH factura:
      INSERT INTO movimientos_financieros (
        empresa_id, tipo_movimiento='INGRESO', monto=factura.monto,
        fecha_evento=factura.fecha, factura_id=factura.id, ...
      ) RETURNING id as mov_id
      UPDATE facturas SET movimiento_id=mov_id WHERE id=factura.id
  
  PASO 3: Validación
    SELECT COUNT(*) FROM gastos WHERE movimiento_id IS NULL
    → Debe ser 0
    
    SELECT COUNT(*) FROM facturas WHERE movimiento_id IS NULL
    → Debe ser 0
    
    SELECT COUNT(*) FROM movimientos_financieros
    → Debe = gastos + facturas
  ```

- [ ] Testing del backfill script:
  - [ ] Ejecutar en staging
  - [ ] Validar datos coinciden (monto, fecha, rfc)
  - [ ] Pólizas siguen funcionando
  - [ ] Permisos (RLS) funcionan
  - [ ] Performance OK (queries < 1 seg)

- [ ] **MILESTONE:** Backfill plan testeado ✅

---

**Tarea 3: Comunicar Cambios (30 min)**

- [ ] Documentar cambios en ARQUITECTURA:
  - [ ] gastos ahora tiene `movimiento_id`
  - [ ] facturas ahora tiene `movimiento_id`
  - [ ] pagos ahora tiene `movimiento_id`
  
- [ ] Comunicar al equipo:
  - Slack: "Arquitectura integral LISTA para mañana"
  - Incluir: Schema, backfill plan, timeline
  - Recordar: OTA 1.0 DEBE usar movimientos_financieros

- [ ] **MILESTONE:** Equipo alineado ✅

---

### EQUIPO B: GastoCheck Integration (1-2 devs)

**Tarea 1: Validar que GastoCheck use movimientos_financieros (2 horas)**

- [ ] Revisar código actual de GastoCheck:
  ```
  Cuando usuario guarda gasto:
    1. INSERT gastos { ... }  ← ACTUAL
    
  Cambiar a:
    1. INSERT movimientos_financieros { tipo='GASTO', ... }
    2. INSERT gastos { movimiento_id=X, ... }
    3. Crear póliza automáticamente:
       INSERT polizas { movimiento_id=X, ... }
  ```

- [ ] Checklist:
  - [ ] INSERT movimientos_financieros en guardar gasto
  - [ ] Monto: negativo (egreso)
  - [ ] Fecha: fecha del gasto
  - [ ] RFC: del proveedor
  - [ ] Categoría: auto-asignada (IA o regla)
  - [ ] Póliza: generada automáticamente
    - [ ] Debit: gasto (monto negativo)
    - [ ] Credit: cuenta de gasto (desglosado)
    - [ ] Validado: Debit = Credit
  - [ ] Exportación SAT: usa data de póliza

- [ ] Testing local:
  - [ ] Capturar gasto (OCR o manual)
  - [ ] Validar que INSERT en movimientos_financieros
  - [ ] Validar que póliza se crea
  - [ ] Validar que exporta a SAT correctamente

- [ ] **MILESTONE:** GastoCheck integration done ✅

---

**Tarea 2: Dashboard WEB — Ver movimientos_financieros (1 hora)**

- [ ] Crear/actualizar endpoint WEB:
  ```
  GET /api/dashboard
  
  Retorna:
  {
    gastos_totales: SUM(movimientos WHERE tipo='GASTO'),
    ingresos_totales: SUM(movimientos WHERE tipo='INGRESO'),
    gastos_por_categoria: GROUP BY categoria,
    polizas_generadas: COUNT(polizas),
    movimientos_sin_reconciliar: COUNT(...),
    caja_esperada: cálculo,
    caja_real: (futuro, cuando BancoCheck)
  }
  ```

- [ ] Testing:
  - [ ] Dashboard carga en < 2 seg
  - [ ] Datos coinciden con gastos/facturas
  - [ ] Pólizas se ven correctamente

- [ ] **MILESTONE:** Dashboard WEB integration done ✅

---

### EQUIPO C: CobraCheck Integration (1-2 devs)

**Tarea 1: Validar que CobraCheck use movimientos_financieros (2 horas)**

- [ ] Revisar código actual de CobraCheck:
  ```
  Cuando usuario crea factura:
    1. INSERT facturas { ... }  ← ACTUAL
    
  Cambiar a:
    1. INSERT movimientos_financieros { tipo='INGRESO', ... }
    2. INSERT facturas { movimiento_id=X, ... }
  
  Cuando usuario registra pago:
    1. UPDATE pagos { estado='PAGADO' }  ← ACTUAL
    
  Cambiar a:
    1. UPDATE movimientos_financieros SET estado_pago='PAGADO'
    2. Crear póliza de cobro automáticamente
  ```

- [ ] Checklist:
  - [ ] INSERT movimientos_financieros al crear factura
  - [ ] UPDATE movimientos_financieros al registrar pago
  - [ ] Monto: positivo (ingreso)
  - [ ] RFC: del cliente
  - [ ] Póliza de cobro: generada automáticamente
    - [ ] Debit: banco (monto positivo)
    - [ ] Credit: cliente (cuenta por cobrar)
    - [ ] Validado: Debit = Credit

- [ ] Testing local:
  - [ ] Crear cliente
  - [ ] Crear factura
  - [ ] Validar INSERT en movimientos_financieros (tipo='INGRESO')
  - [ ] Registrar pago
  - [ ] Validar UPDATE movimientos_financieros (estado='PAGADO')
  - [ ] Validar póliza se crea

- [ ] **MILESTONE:** CobraCheck integration done ✅

---

**Tarea 2: Integración GastoCheck + CobraCheck (1 hora)**

- [ ] Validar que ambos módulos usan la MISMA tabla:
  ```
  Usuario ve en WEB:
  ├─ Gastos capturados: 150 (movimientos WHERE tipo='GASTO')
  ├─ Ingresos registrados: 23 (movimientos WHERE tipo='INGRESO')
  └─ Caja esperada: suma de ambos
  ```

- [ ] Testing:
  - [ ] Capturar gasto (GastoCheck)
  - [ ] Registrar cobro (CobraCheck)
  - [ ] Dashboard muestra AMBOS desde la MISMA tabla
  - [ ] Cálculos correctos (saldo teórico)

- [ ] **MILESTONE:** Integración verificada ✅

---

### EQUIPO D: BancoCheck Skeleton (1 dev - Preparación)

**Tarea: Estructura lista para OTA 1.2 (Semana 2)**

- [ ] Revisar BANCOCHECK_ARCHITECTURE.md
- [ ] Crear tabla `banco_movimientos` schema (sin datos):
  ```sql
  CREATE TABLE banco_movimientos (
    id UUID PRIMARY KEY,
    banco_cuenta_id UUID NOT NULL,
    plaid_transaction_id VARCHAR(100) UNIQUE,
    fecha DATE NOT NULL,
    concepto VARCHAR(255),
    monto DECIMAL(15,2),
    tipo VARCHAR(20),  -- INGRESO, EGRESO
    
    -- INTEGRACIÓN CON ARQUITECTURA
    movimiento_financiero_id UUID REFERENCES movimientos_financieros(id),
    
    estado_reconciliacion VARCHAR(20),
    confianza_match DECIMAL(3,2),
    
    created_at TIMESTAMP DEFAULT now()
  );
  ```

- [ ] **MILESTONE:** Schema BancoCheck skeleton ready ✅

---

## ⏰ Timeline de HOY (Viernes 20)

```
09:00 - 09:30: Standup + Briefing
  └─ Explicar arquitectura integral crítica
  └─ Asignar equipos

09:30 - 11:30: EQUIPO A - Schema + Backfill (2 horas)
  └─ movimientos_financieros FINAL
  └─ Backfill plan testeado

11:30 - 12:00: EQUIPO A - Comunicación (30 min)

12:00 - 13:00: ALMUERZO

13:00 - 15:00: EQUIPOS B + C - Integration (2 horas cada)
  └─ GastoCheck integration
  └─ CobraCheck integration
  └─ Testing local

15:00 - 16:00: EQUIPO B + C - Dashboard + Validación (1 hora)
  └─ Dashboard WEB funciona
  └─ Ambos módulos en la MISMA tabla

16:00 - 16:30: EQUIPO D - BancoCheck skeleton (30 min)

16:30 - 17:00: Final Review + Comunication
  └─ Arquitectura LOCKED (no cambios después)
  └─ Todos saben: Mañana OTA 1.0 sale CON esta arquitectura
  └─ Backfill lunes (miércoles si hay issues)
  └─ Deploy sábado 21 = arquitectura integrada en producción
```

---

## ✅ Success Criteria (End of Day)

- [ ] Tabla `movimientos_financieros` creada con schema FINAL
- [ ] Índices optimizados
- [ ] RLS policies funcionando
- [ ] Backfill script testeado (staging)
- [ ] GastoCheck: INSERT movimientos_financieros working
- [ ] CobraCheck: INSERT/UPDATE movimientos_financieros working
- [ ] Dashboard WEB: Ve gastos + ingresos desde misma tabla
- [ ] Pólizas automáticas: Generadas correctamente
- [ ] Exportación SAT: Funciona
- [ ] BancoCheck skeleton: Schema ready
- [ ] Equipo alineado: "Mañana OTA 1.0 sale con arquitectura integrada"

---

## 🚨 Si Algo Falla (Contingency)

**Si backfill es complejo:**
- Hacer backfill el LUNES (no bloquea OTA 1.0)
- Pero schema DEBE estar LISTO hoy
- GastoCheck/CobraCheck DEBEN usar movimientos_financieros desde el inicio

**Si hay bugs en integración:**
- Hotfixes rápidos (hoy)
- Peor caso: Deploy mañana con arquitectura, ajustar lunes

**Si equipo está abrumado:**
- Reducir scope hoy:
  - MUST HAVE: Arquitectura + schema + backfill plan
  - NICE TO HAVE: Dashboard WEB (puede ser lunes)

---

## 📞 Comunicación al Equipo

**Mensaje Slack (Ahora):**
```
🚨 ARQUITECTURA INTEGRAL HOY (Viernes 20) 🚨

Objetivo: Schema movimientos_financieros FINAL + tested

Por qué crítico:
- OTA 1.0 mañana DEBE usar esta arquitectura
- OTA 1.2 BancoCheck depende de esto
- Si no hacemos hoy, refactor pesado después

Equipos:
- A: Arquitectura base (schema + backfill)
- B: GastoCheck integration
- C: CobraCheck integration
- D: BancoCheck prep

Timeline: 09:00-17:00 (un día, intensive)

Success: "Arquitectura LOCKED, mañana OTA 1.0 sale integrado"

¿Preguntas? Ahora. Empezamos.
```

---

**Esto es la última milla antes de producción. Hoy se hace correctamente, mañana fluye.**

¿Equipo listo?
