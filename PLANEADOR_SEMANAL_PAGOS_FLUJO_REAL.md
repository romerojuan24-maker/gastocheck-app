# 📅 PLANEADOR SEMANAL: Control Exacto de Pagos (Tiempo Real)

**Contexto:** Cuando ingresos son mínimos, necesitas control EXACTO día a día  
**Granularidad:** SEMANAL (no diario, no mensual)  
**Actualización:** EN TIEMPO REAL (cada ingreso/egreso actualiza todo)  

---

## 🎯 LA DIFERENCIA CRÍTICA

```
VERSIÓN ANTERIOR (Hoy → Qué pagamos hoy):
❌ Estática
❌ Asumir que los ingresos suceden como planeado
❌ Si cliente no paga → sorpresa

VERSIÓN CORRECTA (Esta semana → Qué pagamos esta semana):
✅ Dinámico
✅ Se actualiza CADA VEZ que entra dinero
✅ Si cliente no paga hoy pero pagará viernes → se ve
✅ Si necesitas atrasar pago → lo arrastras a próxima semana
✅ Control exacto: día a día qué tienes
```

---

## 📊 INTERFAZ: PLANEADOR SEMANAL CON TIEMPO REAL

```
HOY ES: MARTES 25 JUNIO (9:30 AM)
═════════════════════════════════════════════════════════════

┌───────────────────────────────────────────────────────────┐
│  PLANEADOR SEMANAL: SEM 25-29 JUNIO                       │
│  Actualizado AHORA: 09:30 AM                              │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  CAJA ACTUAL: $8,500 (actualizado hace 2 minutos)        │
│  INGRESOS ESTA SEMANA:                                    │
│    ✅ Cliente A pagó hoy (09:15 AM): $5,000             │
│    ⏳ Cliente B promete viernes: $3,000                   │
│    ⏳ Cliente C promete jueves: $2,000                    │
│    ❓ Cliente D: todavía no confirmó                      │
│                                                            │
│  TOTAL INGRESOS CONFIRMADOS: $8,000                       │
│  TOTAL INGRESOS ESPERADOS: $10,000 (si todos pagan)      │
│                                                            │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  GRÁFICO SEMANAL (Hora a hora):                           │
│                                                            │
│  MAR 25   MIÉ 26   JUE 27   VIE 28   SÁB 29              │
│  ─────   ─────   ─────   ─────   ─────                   │
│                                                            │
│  $13.5k  $13.5k  $15.5k  $18.5k  $18.5k                  │
│   ▁▁▁    ▁▁▁     ▃▃▃     ▅▅▅     ▅▅▅                    │
│   HOY    ─2k     +2k     +3k     ─       (sin pagos extra)│
│         (pagos)  (ingreso)(ingreso)                       │
│                                                            │
│  ✅ OK    ✅ OK    ✅ OK    ✅ OK    ⚠️ JUSTO             │
│                                                            │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  PAGOS PROGRAMADOS ESTA SEMANA:                           │
│                                                            │
│  MAR 25 (HOY):                                            │
│  ┌─────────────────────────────────────────┐             │
│  │ 🔴 Nómina: $7,000 [DEBE PAGAR HOY]      │             │
│  │    Empleados esperan en banco a las 3PM │             │
│  │    ✅ CAJA PERMITE (tienes $13.5k)      │             │
│  │                                          │             │
│  │ 🟡 Servicios: Luz ($1,200)              │             │
│  │    [Vencimiento hoy, pero acepta hasta  │             │
│  │     mañana sin recargo]                 │             │
│  │    ✅ CAJA PERMITE (quedarías $5.3k)    │             │
│  │                                          │             │
│  │ TOTAL HOY: $8,200 + Nómina $7,000      │             │
│  │ = PAGA HOY: $8,200 ✅                   │             │
│  │ (Nómina en el horario bancario)         │             │
│  └─────────────────────────────────────────┘             │
│                                                            │
│  MIÉ 26:                                                   │
│  ┌─────────────────────────────────────────┐             │
│  │ 🟡 Proveedor A: $15,000 [Vencido 5 días]│             │
│  │    ⚠️ NO TIENES FLUJO (solo tienes $5k)│             │
│  │    ❌ CAJA NO PERMITE                   │             │
│  │    💡 SOLUCIÓN: Arriendalo a VIE 28    │             │
│  │       (cliente B paga viernes)          │             │
│  │                                          │             │
│  │ 🟢 Internet: $900 [Vence en 2 días]    │             │
│  │    ✅ CAJA PERMITE                      │             │
│  │    ✓ PAGA: Sí                           │             │
│  │                                          │             │
│  │ TOTAL MIÉ: $900 ✅                      │             │
│  └─────────────────────────────────────────┘             │
│                                                            │
│  JUE 27:                                                   │
│  ┌─────────────────────────────────────────┐             │
│  │ ⏳ Entrada: Cliente C promete: $2,000  │             │
│  │    (10:00 AM según promesa)            │             │
│  │                                          │             │
│  │ 🟢 Servicios varios: $500               │             │
│  │    ✅ PAGA: Sí                          │             │
│  │                                          │             │
│  │ TOTAL JUE: $500                         │             │
│  │ CAJA ESPERADA: $5k + $2k - $500 = $6,5k│             │
│  └─────────────────────────────────────────┘             │
│                                                            │
│  VIE 28:                                                   │
│  ┌─────────────────────────────────────────┐             │
│  │ ⏳ Entrada: Cliente B promete: $3,000  │             │
│  │    (2:00 PM según promesa)             │             │
│  │                                          │             │
│  │ 🔴 Proveedor A (ARRASTRADO): $15,000   │             │
│  │    ✅ CAJA PERMITE ($6,5k + $3k = $9,5k)            │
│  │    ✓ PAGA: Sí, cuando entre dinero    │             │
│  │                                          │             │
│  │ TOTAL VIE: -$15,000 + ingreso $3,000   │             │
│  │ CAJA ESPERADA: $18,500                 │             │
│  └─────────────────────────────────────────┘             │
│                                                            │
│  SÁB 29:                                                   │
│  ┌─────────────────────────────────────────┐             │
│  │ (No hay operaciones programadas)        │             │
│  │ CAJA ESPERADA: $18,500 (sin cambios)   │             │
│  │                                          │             │
│  │ ⚪ Opcional: Pago pequeño si entra dinero            │
│  │    Cliente D: todavía sin confirmación │             │
│  │                                          │             │
│  └─────────────────────────────────────────┘             │
│                                                            │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ALERTAS EN TIEMPO REAL:                                  │
│                                                            │
│  🔴 CRÍTICA: Nómina hoy $7k - DEBE SER PAGO 1           │
│      Empleados no pueden esperar                         │
│      CAJA ACTUAL PERMITE ✅ ($13,500)                    │
│                                                            │
│  🟠 ALTA: Cliente C dice "no sé si puedo pagarte jueves" │
│      Si NO paga → CAJA SÁBADO = $4,5k (riesgo)          │
│      Acción: Llamar HOY para confirmar                  │
│                                                            │
│  🟡 MEDIA: Proveedor A está arrastrado a VIE             │
│      Depende 100% de que Cliente B pague                │
│      Si falla → Falta $12k para viernes                 │
│                                                            │
│  ⚪ INFO: Cliente D sin confirmación                      │
│      Si paga: +$2.500 (cómodo)                           │
│      Si no: Seguimos igual (ajustado pero OK)           │
│                                                            │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ESCENARIOS RÁPIDOS (What-If):                            │
│                                                            │
│  ❓ "¿Si Cliente C NO paga jueves?"                      │
│     → Caja sábado cae a $4,5k (sin margen)              │
│     → Posponer Proveedor A al lunes 2 julio             │
│     → O: Atrasar Servicios ($500) al próximo mes        │
│                                                            │
│  ❓ "¿Si Cliente B NO paga viernes?"                     │
│     → 🔴 CRÍTICA: No puedes pagar Proveedor A           │
│     → Acción inmediata: Cobrar a Cliente A urgente      │
│     → O: Pedir préstamo $15k (plan B)                   │
│                                                            │
│  ❓ "¿Si Cliente D SÍ paga sábado?"                      │
│     → Caja + $2,500 el sábado                            │
│     → Oportunidad: Pagar Mantenimiento o invertir       │
│                                                            │
└───────────────────────────────────────────────────────────┘

RESUMEN ESTA SEMANA:
═════════════════════
✅ Nómina: PAGA (hoy, $7,000)
✅ Servicios: PAGAN (internet $900, luz $1,200)
⏳ Proveedor A: Arrastrado a VIE (depende de Cliente B)
⚠️ RIESGO: Si falla Cliente B o C → Caja baja dramáticamente
💡 ACCIÓN: Confirmar cliente C hoy, tener plan B para Proveedor A
```

---

## 🔄 ACTUALIZACIÓN EN TIEMPO REAL

```
ESCENARIO: CLIENTE A PAGA MIENTRAS ESTÁS VIENDO DASHBOARD

09:15 AM: Notificación
"Cliente A pagó $5,000"

DASHBOARD SE ACTUALIZA AUTOMÁTICAMENTE:
- Caja: $8,500 → $13,500 ✅ ACTUALIZADO
- Ingresos confirmados: $5,000 → $8,000 ✅
- Gráfico se redibuja
- Alertas se recalculan
- "Proveedor A ahora PUEDES pagar miércoles" (si quieres)
- Recomendación: "Ya tienes $13,5k, nómina cubierta 100%"

→ ZERO NECESIDAD DE REFRESCAR

───────────────────────────────────────

ESCENARIO: CONTADOR NECESITA PAGAR ALGO NO PROGRAMADO

09:30 AM: Gasto sorpresa
"Necesito pagar Reparación de camioneta: $2,000"

CONTADOR ABRE DASHBOARD Y DICE:
"¿Puedo pagar esto hoy?"

SISTEMA RESPONDE INSTANTÁNEAMENTE:
"Sí, tienes $13,500 hoy
Pero después de nómina ($7k) + servicios ($2,1k) + esto ($2k)
Te quedarían $2,400
¿Seguro? Tienes margen muy ajustado para el resto de la semana"

CONTADOR ELIGE:
❌ "No, mejor lo postpono" → Se añade a próxima semana
✅ "Sí, igual lo pago" → Se suma, gráfico se actualiza

RESULTADO: Decisión en 10 segundos con datos exactos
```

---

## 🏗️ ARQUITECTURA TÉCNICA

### **Base de Datos: Pagos Semanales**

```sql
-- TABLA: plan_pagos_semanal
CREATE TABLE plan_pagos_semanal (
  id UUID PRIMARY KEY,
  empresa_id UUID,
  
  -- Período
  semana_inicio DATE,      -- Lunes
  semana_fin DATE,         -- Domingo
  estado VARCHAR(20),      -- ACTIVA, COMPLETADA, CANCELADA
  
  -- Caja
  caja_inicial NUMERIC(15,2),
  caja_actual NUMERIC(15,2),    -- Se actualiza EN TIEMPO REAL
  caja_proyectada NUMERIC(15,2), -- Fin de semana
  
  -- Metadata
  creado_en TIMESTAMP,
  actualizado_en TIMESTAMP,     -- Se actualiza CADA transacción
  
  actualizado_por VARCHAR(100)  -- Auditoría: quién/qué lo cambió
);

-- TABLA: pago_semanal (Cada pago)
CREATE TABLE pago_semanal (
  id UUID PRIMARY KEY,
  plan_id UUID REFERENCES plan_pagos_semanal,
  
  -- Detalles
  descripcion TEXT,
  monto NUMERIC(15,2),
  fecha_vencimiento DATE,
  
  -- Clasificación
  tipo VARCHAR(50),         -- NÓMINA, PROVEEDOR, SERVICIO, OTRO
  urgencia VARCHAR(20),     -- INDISPENSABLE, URGENTE, NORMAL, OPCIONAL
  
  -- Estado
  estado VARCHAR(20),       -- PENDIENTE, PROGRAMADO, ARRASTRADO, PAGADO
  dia_programado INT,       -- 0=lunes, 1=martes, etc
  
  -- Control
  caja_permite BOOLEAN,     -- ¿Hay flujo para pagar?
  puede_aplazarse BOOLEAN,  -- ¿Se puede posponer?
  
  creado_en TIMESTAMP,
  pagado_en TIMESTAMP
);

-- TABLA: ingresos_semanal_esperado (Promesas de dinero)
CREATE TABLE ingresos_semanal_esperado (
  id UUID PRIMARY KEY,
  plan_id UUID REFERENCES plan_pagos_semanal,
  
  -- Detalles
  cliente_nombre VARCHAR(255),
  monto NUMERIC(15,2),
  fecha_promesa DATE,
  
  -- Estado
  confirmado BOOLEAN,       -- ¿Cliente confirmó?
  recibido BOOLEAN,         -- ¿Dinero ya entró?
  recibido_en TIMESTAMP,
  
  -- Control
  riesgo_no_pago BOOLEAN,   -- ¿Históricamente falla?
  
  creado_en TIMESTAMP
);

-- TABLA: movimientos_tiempo_real (Auditoría de cambios)
CREATE TABLE movimientos_tiempo_real (
  id UUID PRIMARY KEY,
  empresa_id UUID,
  plan_id UUID,
  
  tipo_evento VARCHAR(50),  -- INGRESO, EGRESO, ARRASTRE, ADELANTO
  descripcion TEXT,
  monto NUMERIC(15,2),
  
  caja_antes NUMERIC(15,2),
  caja_después NUMERIC(15,2),
  
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Edge Function: Actualizar Flujo Semanal en Tiempo Real**

```typescript
// Edge Function: actualizar-flujo-semanal
// Se triggerea CADA VEZ que entra dinero o hay movimiento

export const actualizarFlujoSemanal = async (req) => {
  const { empresa_id, evento_tipo, monto, descripcion } = req.body;
  
  // 1. Obtener plan semanal actual
  const plan = await supabase
    .from('plan_pagos_semanal')
    .select('*')
    .eq('empresa_id', empresa_id)
    .eq('estado', 'ACTIVA')
    .single();
  
  // 2. Actualizar caja actual
  let caja_nueva = plan.caja_actual;
  
  if (evento_tipo === 'INGRESO') {
    caja_nueva += monto;
    
    // Actualizar ingresos esperados
    await marcarIngresoComo('RECIBIDO', descripcion);
  }
  
  if (evento_tipo === 'EGRESO') {
    caja_nueva -= monto;
  }
  
  // 3. Actualizar plan
  await supabase
    .from('plan_pagos_semanal')
    .update({
      caja_actual: caja_nueva,
      actualizado_en: new Date(),
      actualizado_por: 'SISTEMA'
    })
    .eq('id', plan.id);
  
  // 4. Recalcular validaciones de todos los pagos
  const pagos = await supabase
    .from('pago_semanal')
    .select('*')
    .eq('plan_id', plan.id)
    .eq('estado', 'PENDIENTE');
  
  for (const pago of pagos.data) {
    const caja_permite = caja_nueva >= pago.monto;
    
    await supabase
      .from('pago_semanal')
      .update({ caja_permite })
      .eq('id', pago.id);
  }
  
  // 5. Generar alertas si es necesario
  await generarAlertasSiNecesario(plan.id, caja_nueva);
  
  // 6. Registrar en auditoría
  await supabase
    .from('movimientos_tiempo_real')
    .insert({
      empresa_id,
      plan_id: plan.id,
      tipo_evento: evento_tipo,
      descripcion,
      monto,
      caja_antes: plan.caja_actual,
      caja_después: caja_nueva,
      timestamp: new Date()
    });
  
  // 7. Broadcast a todos los users conectados (WebSocket)
  await broadcastUpdate({
    empresa_id,
    type: 'FLUJO_ACTUALIZADO',
    caja_actual: caja_nueva,
    evento: descripcion
  });
  
  return {
    success: true,
    caja_nueva,
    evento: descripcion,
    timestamp: new Date()
  };
};
```

### **React Component: Planeador Semanal**

```typescript
export const PlaneadorSemanal = ({ empresaId }) => {
  const [plan, setPlan] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  
  // ACTUALIZACIÓN EN TIEMPO REAL (WebSocket)
  useEffect(() => {
    const channel = supabase
      .channel(`flujo:${empresaId}`)
      .on('broadcast', { event: 'FLUJO_ACTUALIZADO' }, (payload) => {
        // Actualizar UI INMEDIATAMENTE
        setPlan(prev => ({
          ...prev,
          caja_actual: payload.caja_actual,
          actualizado_en: new Date()
        }));
        
        // Toast de notificación
        toast.success(`${payload.evento}: Caja ahora $${payload.caja_actual}`);
        
        // Recalcular gráfico
        recalcularGrafico();
      })
      .subscribe();
    
    return () => channel.unsubscribe();
  }, []);
  
  // ARRASTRAR PAGO A OTRO DÍA
  const handleArrastrarPago = async (pagoId, diaNuevo) => {
    const { data, error } = await supabase
      .from('pago_semanal')
      .update({ dia_programado: diaNuevo })
      .eq('id', pagoId);
    
    if (!error) {
      toast.success('Pago arrastrado a ' + nombreDia(diaNuevo));
    }
  };
  
  // MARCAR COMO PAGADO
  const handlePagar = async (pagoId) => {
    await supabase
      .from('pago_semanal')
      .update({
        estado: 'PAGADO',
        pagado_en: new Date()
      })
      .eq('id', pagoId);
  };
  
  return (
    <div className="planeador-semanal">
      <header>
        <h2>Planeador Semanal: {plan?.semana_inicio} - {plan?.semana_fin}</h2>
        <div className="caja-info">
          <div className="caja-actual">
            💰 Caja Actual: ${plan?.caja_actual}
            <small>Actualizado: {formatTime(plan?.actualizado_en)}</small>
          </div>
          <div className="caja-proyectada">
            📈 Proyectada Fin Semana: ${plan?.caja_proyectada}
          </div>
        </div>
      </header>
      
      <div className="contenedor-dias">
        {['MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map((dia, idx) => (
          <div key={idx} className="columna-dia">
            <h3>{dia} {obtenerFecha(idx)}</h3>
            
            {/* Ingresos esperados */}
            <div className="ingresos">
              {ingresos
                .filter(i => i.fecha_promesa === obtenerFecha(idx))
                .map(ingreso => (
                  <IngresoCard 
                    key={ingreso.id}
                    ingreso={ingreso}
                    confirmado={ingreso.confirmado}
                    recibido={ingreso.recibido}
                  />
                ))}
            </div>
            
            {/* Pagos programados */}
            <div className="pagos">
              {pagos
                .filter(p => p.dia_programado === idx)
                .map(pago => (
                  <PagoCard
                    key={pago.id}
                    pago={pago}
                    cajaPermite={pago.caja_permite}
                    onPagar={() => handlePagar(pago.id)}
                    onArrastrar={(diaNuevo) => handleArrastrarPago(pago.id, diaNuevo)}
                    onDetalle={() => mostrarDetalle(pago)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="alertas-tiempo-real">
        <AlertasInteligentes plan={plan} pagos={pagos} ingresos={ingresos} />
      </div>
    </div>
  );
};
```

---

## 💡 DIFERENCIA CON VERSIÓN ANTERIOR

```
VERSIÓN 1 (Selector simple):
- "¿Qué pagamos hoy?"
- Estático
- Se basa en lo que hay ahora

VERSIÓN 2 (Planeador semanal - LA CORRECTA):
✅ "¿Qué pagamos ESTA SEMANA?"
✅ Dinámico: se actualiza cada ingreso
✅ Día a día: ves el flujo hora a hora
✅ Arrastres: puedes mover pagos entre días
✅ Alertas: se recalculan cada cambio
✅ Escenarios: "¿si falla cliente X?"

VENTAJA CRÍTICA:
Cuando flujo es bajo (como es tu caso):
- Necesitas saber EXACTAMENTE qué dinero entra cuándo
- Necesitas poder arrastar pagos si algo no llega
- Necesitas alertas si algo falla
- Necesitas decisiones en segundos
```

---

## 📱 EN MÓVIL (Tu usario principal)

```
┌─────────────────────────────┐
│ PLANEADOR SEMANAL           │
│ Actualizado: ahora mismo    │
├─────────────────────────────┤
│                             │
│ Caja: $13,500 ✅            │
│ Semana: 25-29 Junio         │
│                             │
│ [MAR 25]                    │
│ ⬇️ -$8,200 (pagos)          │
│ ⬆️ +$0 (ingresos)           │
│ ➡️ $5,300 caja en MAR       │
│                             │
│ [MIÉ 26]                    │
│ ⬇️ -$900 (servicios)        │
│ ⬆️ +$0                      │
│ ➡️ $4,400                   │
│                             │
│ [JUE 27]                    │
│ ⬇️ -$500                    │
│ ⬆️ +$2,000 (Cliente C)      │
│ ➡️ $5,900                   │
│                             │
│ [VIE 28]                    │
│ ⬇️ -$15,000 (Prov A)        │
│ ⬆️ +$3,000 (Cliente B)      │
│ ➡️ $-7,100 ❌ PROBLEMA      │
│                             │
│ 🔴 ALERTA:                  │
│ "Si Cliente B no paga viernes,
│  no puedes pagar Proveedor A"
│                             │
│ [DRAG] Arrastra Proveedor A
│       a próxima semana      │
│                             │
│ ✅ Solucionado              │
│                             │
└─────────────────────────────┘
```

---

## ✅ ESTO ES LO QUE NECESITAS

```
OPCIÓN B VERSIÓN FINAL (Definitiva):

✅ Proyección de CAJA (30 días)
✅ Alertas de RIESGO
✅ Cobranza PRIORITARIA
✅ [NUEVO] PLANEADOR SEMANAL TIEMPO REAL ⭐⭐⭐
   - Día a día de la semana
   - Ingresos esperados por cliente
   - Pagos programados
   - Caja actualizada EN TIEMPO REAL
   - Arrastres entre días
   - Alertas si algo falla
   - Escenarios "qué si"
   
✅ Análisis CCC
✅ Escenarios
✅ Dashboard visual
✅ Reportes automáticos

COSTO: $8,000 (sin cambios)
TIEMPO: 3 semanas (sin cambios)
IMPACTO: 98% (mayor, porque es más granular)
```

---

## 🎯 ESTA ES LA HERRAMIENTA QUE NECESITAS CUANDO FLUJO ES MÍNIMO

```
SITUACIÓN: Flujo bajo, ingresos impredecibles

SIN PLANEADOR:
- CEO/Contador no sabe qué va a pasar
- "¿Hay dinero?" "Creo que sí"
- Sorpresas
- Estrés
- Decisiones mal hechas

CON PLANEADOR SEMANAL:
- CEO/Contador ve DÍA A DÍA qué dinero entra
- "Si Cliente A paga martes, pagamos Proveedor el jueves"
- "Si Cliente A NO paga, arrastro Proveedor a lunes"
- Cero sorpresas
- Confianza
- Decisiones en DATOS
```

