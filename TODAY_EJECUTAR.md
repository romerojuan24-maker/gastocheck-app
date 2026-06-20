# ⚡ HOY EJECUTAR — Arquitectura Integral (Viernes 20, 09:00-17:00)

**Status:** 🚀 INICIADO

---

## 🎯 MISIÓN (1 párrafo)

Crear tabla `movimientos_financieros` FINAL, integrar GastoCheck + CobraCheck, verificar pólizas automáticas funcionan. Arquitectura BLOQUEADA hoy. Deploy OTA 1.0 mañana.

---

## 📋 TAREAS POR EQUIPO

### EQUIPO A: Daniel + 1 dev (Arquitectura Base)

**TAREA 1: Ejecutar migration SQL (1 hora)**
```
Archivo: supabase/migrations/20260620_001_movimientos_financieros.sql

Pasos:
1. Abrir Supabase console
2. SQL Editor
3. Copiar contenido del archivo
4. Ejecutar
5. Validar: 
   - Tabla movimientos_financieros creada ✅
   - Índices creados ✅
   - RLS policy creada ✅
   - Extensiones a gastos/facturas/pagos creadas ✅
```

**TAREA 2: Backfill script testeado (1 hora)**
```
Crear archivo: supabase/functions/backfill-movimientos/backfill.sql

Script:
1. INSERT movimientos desde gastos existentes
2. UPDATE gastos SET movimiento_id = X
3. INSERT movimientos desde facturas existentes
4. UPDATE facturas SET movimiento_id = X
5. VALIDACIÓN: COUNT(*) gastos sin movimiento_id = 0
6. VALIDACIÓN: COUNT(*) facturas sin movimiento_id = 0

Ejecutar en STAGING (no producción aún)
Validar: Sin errores, datos correctos
```

**TAREA 3: Comunicar al equipo (30 min)**
```
Slack #arquitectura-sprint:
"✅ Arquitectura integral LISTA:
- movimientos_financieros creada
- Backfill script testeado
- Ready para equipos B y C"
```

**Status al finalizar:**
- [ ] Migration ejecutada en staging
- [ ] Backfill script testeado
- [ ] Equipo comunicado

---

### EQUIPO B: 1-2 devs (GastoCheck Integration)

**TAREA 1: Usar Edge Function boilerplate (2 horas)**
```
Archivo existente: supabase/functions/guardar-gasto-integrado/index.ts

Este archivo IMPLEMENTA:
1. INSERT movimientos_financieros
2. INSERT gastos (con movimiento_id)
3. CREATE póliza automáticamente

QUÉ HACER:
1. Revisar el código (está comentado)
2. Copiar lógica al código actual de GastoCheck
3. Cambiar endpoint a llamar este Edge Function
4. Testing local: Capturar gasto → Verifica INSERT movimientos
```

**TAREA 2: Testing local (1 hora)**
```
Pasos:
1. Capturar gasto (OCR o manual)
2. Validar que INSERT en movimientos_financieros
3. Validar que INSERT en gastos (con movimiento_id)
4. Validar que póliza se crea automáticamente
5. Validar que póliza tiene debit/credit correcto
6. Exportar a SAT: Funciona?

Si todo OK → ✅
Si hay error → Reporta a Equipo A
```

**Status al finalizar:**
- [ ] Edge Function integrado
- [ ] INSERT movimientos working
- [ ] Pólizas creadas
- [ ] Testing OK

---

### EQUIPO C: 1-2 devs (CobraCheck Integration)

**TAREA 1: Pattern igual a GastoCheck (2 horas)**
```
Patrón para CobraCheck:

Cuando usuario CREA FACTURA:
1. INSERT movimientos_financieros { tipo='INGRESO', ... }
2. INSERT facturas { movimiento_id=X, ... }

Cuando usuario REGISTRA PAGO:
1. UPDATE movimientos_financieros { estado_pago='PAGADO', ... }
2. CREATE póliza de cobro automáticamente:
   - Debit: banco (cuenta por cobrar)
   - Credit: cliente
3. UPDATE poliza_id en movimientos

Archivo de referencia: supabase/functions/guardar-gasto-integrado/index.ts
(patrón es el mismo, solo cambiar tipo_movimiento y cuentas)
```

**TAREA 2: Testing local (1 hora)**
```
Pasos:
1. Crear cliente + factura
2. Validar INSERT movimientos_financieros
3. Registrar pago
4. Validar UPDATE movimientos_financieros
5. Validar póliza de cobro se crea
6. Validar debit=credit en póliza

Si todo OK → ✅
Si hay error → Reporta a Equipo A
```

**Status al finalizar:**
- [ ] INSERT movimientos working (crear factura)
- [ ] UPDATE movimientos working (registrar pago)
- [ ] Pólizas de cobro creadas
- [ ] Testing OK

---

### EQUIPO D: 1 dev (BancoCheck Skeleton)

**TAREA: Schema banco_movimientos ready (1 hora)**
```
Archivo: supabase/migrations/20260620_001_movimientos_financieros.sql

Ya incluye schema banco_movimientos SKELETON:
- Tabla creada
- Con referencia a movimiento_financiero_id
- Índices listos

QUÉ HACER:
1. Validar que se creó en BD
2. Documentar para equipo (comentarios)
3. Ready para OTA 1.2 (semana 2)
```

**Status al finalizar:**
- [ ] Schema banco_movimientos validado
- [ ] Documentación actualizada

---

## ⏱️ TIMELINE DE HOY

```
09:00 - 09:30: Standup
  └─ Explicar por qué hoy es crítico
  └─ Asignar definitivamente equipos

09:30 - 11:30: TRABAJO (Equipo A)
  └─ Migration + backfill script

09:30 - 12:00: TRABAJO (Equipos B + C)
  └─ Integration + testing

12:00 - 13:00: ALMUERZO

13:00 - 15:00: TRABAJO (continuación)
  └─ Testing + refinamiento

15:00 - 16:00: INTEGRACIÓN FINAL
  └─ Validar todos los equipos
  └─ Dashboard WEB consolidado

16:00 - 16:30: VALIDACIÓN FINAL
  ├─ movimientos_financieros + gastos + facturas
  ├─ Pólizas se crean OK
  └─ Backfill script testeado

16:30 - 17:00: CIERRE
  ├─ Slack: "✅ Arquitectura LOCKED"
  ├─ Mensaje: "Mañana deploy OTA 1.0"
  └─ High five 🎉
```

---

## ✅ SUCCESS CRITERIA

**MUST HAVE (sin esto, NO deploy mañana):**
- [ ] movimientos_financieros creada + testeada
- [ ] GastoCheck INSERT movimientos working
- [ ] CobraCheck INSERT/UPDATE movimientos working
- [ ] Pólizas se crean automáticamente
- [ ] Backfill script testeado
- [ ] Equipo alineado

**NICE TO HAVE:**
- [ ] Dashboard WEB consolidado
- [ ] BancoCheck skeleton refinado

---

## 🚨 SI HAY PROBLEMAS

**Migration SQL falla:**
→ Reporta error a Equipo A
→ Daniel debuggea

**Integration toma más tiempo:**
→ Extender hasta las 17:30 si es necesario
→ Pero "arquitectura LOCKED" debe estar a las 17:00

**Algún equipo bloqueado:**
→ Slack inmediatamente
→ Otro equipo ayuda
→ No esperes a fin de día

---

## 📞 COMUNICACIÓN

**Slack #arquitectura-sprint:**

09:00 - Standup
10:00 - Equipo A: "Migration ejecutada ✅"
11:00 - Equipos B+C: "Integration en progreso"
12:00 - Almuerzo
13:00 - Status update
14:00 - "Testing final en progreso"
15:00 - "Dashboard consolidado OK"
16:00 - "Validación final"
16:30 - "🎉 Arquitectura LOCKED"

---

## 🎯 MAÑANA (Sábado 21)

Si arquitectura está lista hoy:
```
09:00: Deploy OTA 1.0 GastoCheck (con arquitectura integrada)
10:00: Deploy EAS (TestFlight + Play Store)
12:00: Usuarios reales usando
17:00: ✅ OTA 1.0 EN VIVO
```

---

**AHORA. VAMOS.**

¿Preguntas antes de empezar? Slack.

Sino: **EMPEZAR A LAS 09:00**
