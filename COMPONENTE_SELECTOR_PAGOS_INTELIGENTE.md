# 🎯 COMPONENTE: SELECTOR DE PAGOS INTELIGENTE (Drag & Drop)

**Parte de:** Opción B - Flujo Completo  
**Interfaz:** Dashboard de Pagos  
**Tecnología:** React + Drag-Drop + Validación de flujo  

---

## 📋 VISIÓN GENERAL

```
┌─────────────────────────────────────────────────────────┐
│         SELECTOR DE PAGOS INTELIGENTE                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FLUJO ESTIMADO: $52,000 (próximos 30 días)           │
│  Cobranza comprometida: $35,000                        │
│  Disponible para pagar: $35,000 ✅                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  COL 1: ADEUDOS        │  COL 2: A PAGAR  │ COL 3: SUMA│
│  (Total: $48,000)      │  (Total: $35,0)  │           │
│  ────────────────────  │  ────────────────│           │
│                        │                  │           │
│  🔴 NÓMINA $7,000 ──→  │  🔴 NÓMINA      │ $7,000    │
│     [INDISPENSABLE]    │     $7,000      │           │
│                        │                  │           │
│  🟡 Proveedor A        │  🟡 Proveedor A │ $15,000   │
│     $15,000            │     $15,000      │           │
│     [Vencido 10 días]  │                  │           │
│                        │  🟢 Luz/Internet│ $2,100    │
│  🟢 Servicios          │     $2,100      │           │
│     Luz: $1,200        │                  │           │
│     Internet: $900     │  🟠 Proveedor B │ $10,900   │
│     [Vence en 20 días] │     $10,900     │           │
│                        │                  │           │
│  🟠 Proveedor B        │                  │           │
│     $10,900            │  [SIN ESPACIO]   │           │
│     [Vence en 45 días] │                  │ ─────────│
│                        │                  │ $35,000   │
│  ⚪ Mantenimiento      │                  │ ✅ VALIDADO
│     $3,000             │                  │           │
│     [Próximo mes]      │                  │           │
│                        │                  │           │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 INTERFAZ (4 COLUMNAS)

### **COLUMNA 1: ADEUDOS (Todos los gastos por pagar)**

```
┌─────────────────────────────┐
│    ADEUDOS PENDIENTES       │
│    Total: $48,000           │
├─────────────────────────────┤
│                             │
│ 🔴 NÓMINA - $7,000          │ ← Rojo = Indispensable
│    Empresa                  │    Se arrastra automático
│    [Vencimiento: Hoy]       │    
│    [AUTOMÁTICO]             │
│                             │
│ 🟡 Proveedor A - $15,000    │ ← Naranja = Urgente
│    Compra #5432             │    Vencido 10 días
│    [Vencimiento: Hace 10d]  │    Arrastra al pagar
│                             │
│ 🟢 Servicios - $1,200       │ ← Verde = Normal
│    Luz (CFE)                │    Vence pronto
│    [Vencimiento: En 20d]    │
│                             │
│ 🟢 Servicios - $900         │ ← Verde = Normal
│    Internet (Infinitum)     │
│    [Vencimiento: En 20d]    │
│                             │
│ 🟠 Proveedor B - $10,900    │ ← Naranja = Vence pronto
│    Compra #5433             │
│    [Vencimiento: En 45d]    │
│                             │
│ ⚪ Mantenimiento - $3,000   │ ← Gris = Sin urgencia
│    Oficina                  │    Próximo mes
│    [Vencimiento: En 60d]    │
│                             │
└─────────────────────────────┘

LEYENDA:
🔴 ROJO = Indispensable (nómina, servicios críticos)
🟡 NARANJA = Vencido o vence en < 15 días
🟢 VERDE = Normal (vence en 15-30 días)
⚪ GRIS = Sin urgencia (vence en > 30 días)
```

### **COLUMNA 2: A PAGAR (Arrastra aquí)**

```
┌─────────────────────────────┐
│      A PAGAR AHORA          │
│      Total: $35,000         │
├─────────────────────────────┤
│                             │
│ 🔴 NÓMINA - $7,000          │ ← Auto-añadido
│    ✓ Automático             │
│                             │
│ 🟡 Proveedor A - $15,000    │ ← Arrastrado
│    ✓ Validado               │
│                             │
│ 🟢 Luz - $1,200             │ ← Arrastrado
│    ✓ Validado               │
│                             │
│ 🟢 Internet - $900          │ ← Arrastrado
│    ✓ Validado               │
│                             │
│ [SIN ESPACIO]               │ ← NO PUEDES ARRASTRAR MÁS
│ "Flujo insuficiente"        │
│                             │
│                             │
└─────────────────────────────┘
```

### **COLUMNA 3: VALIDACIÓN EN TIEMPO REAL**

```
┌──────────────────────────────┐
│   VALIDACIÓN DE FLUJO        │
├──────────────────────────────┤
│                              │
│ Flujo disponible:            │
│ $35,000                      │
│                              │
│ Pagos seleccionados:         │
│ $35,000                      │
│                              │
│ Diferencia:                  │
│ $0 ✅ VALIDADO               │
│                              │
│ Status:                      │
│ ✅ Flujo suficiente          │
│ ✅ Nómina cubierta           │
│ ✅ Urgentes pagadas          │
│                              │
│ Recomendación:               │
│ "Perfecto, así está bien"    │
│                              │
└──────────────────────────────┘
```

---

## 🔧 LÓGICA: CÓMO FUNCIONA

### **1. CLASIFICACIÓN AUTOMÁTICA DE GASTOS**

```
SISTEMA CLASIFICA:

🔴 INDISPENSABLES (Se van automáticos a PAGAR):
   ├─ Nómina
   ├─ Servicios críticos (electricidad, agua, internet)
   ├─ Proveedores con contrato
   └─ Impuestos/obligaciones legales

🟡 URGENTES (En ADEUDOS pero destacados):
   ├─ Vencidos > 10 días
   ├─ Vencen en < 15 días
   └─ Monto > $10,000

🟢 NORMALES (En ADEUDOS):
   ├─ Vencen en 15-30 días
   └─ Monto < $10,000

⚪ SIN URGENCIA (En ADEUDOS):
   ├─ Vencen en > 30 días
   └─ Monto variable
```

### **2. VALIDACIÓN DE FLUJO**

```
Cuando arrastras un gasto de ADEUDOS → A PAGAR:

SISTEMA VALIDA:

✅ ¿Tengo flujo suficiente?
   Flujo_disponible >= Nuevo_pago?
   
✅ ¿Cubre la nómina?
   Flujo_después_pago >= Nómina?
   
✅ ¿Vencimiento?
   ¿Es urgente? ¿Tiene plazo?
   
RESULTADO:
   ✅ PUEDES ARRASTRAR → Se suma a COL 2
   ❌ NO PUEDES ARRASTRAR → Gris, tooltip: "Flujo insuficiente"
```

### **3. DINÁMICAS DEL DRAG & DROP**

```
ESCENARIO 1: Arrastras Proveedor A ($15,000)
┌──────────┬──────────┬───────────┐
│ ADEUDOS  │ A PAGAR  │ SUMA      │
│ -$15k    │ +$15k    │ $35,000   │
└──────────┴──────────┴───────────┘
Validación: ✅ OK
Status: "Flujo suficiente, perfecto"

ESCENARIO 2: Arrastras Proveedor B ($10,900) cuando ya hay $35k
┌──────────┬──────────┬───────────┐
│ ADEUDOS  │ A PAGAR  │ SUMA      │
│         │ ???????  │ $45,900   │
└──────────┴──────────┴───────────┘
Validación: ❌ FAIL
Status: "No hay flujo ($10,900 faltante)"
Acción: Se rechaza el drag, vuelve a ADEUDOS
Alternativa: "Paga después de cobrar a Cliente X"
```

### **4. AUTO-COLOCACIÓN DE INDISPENSABLES**

```
NÓMINA SIEMPRE SE COLOCA AUTOMÁTICAMENTE:

ON LOAD del dashboard:
   IF gasto.tipo = 'NÓMINA' THEN
      col2.add(gasto)  ← Se auto-añade
      validación.check_flujo()
      
   IF flujo_insuficiente THEN
      ALERTA: 🔴 CRÍTICA "No hay flujo para nómina"
      Acción recomendada: "Cobrar urgente Cliente X"
```

---

## 📊 EJEMPLOS DE USO REAL

### **EJEMPLO 1: Empresa Ferretería**

```
ESTADO INICIAL:

Flujo próximos 30 días: $52,000
- Cobranza comprometida: $35,000
- Otros ingresos: $17,000
- Gastos programados: $48,000

ADEUDOS:
🔴 Nómina $7,000 (hoy)
🟡 Proveedor A $15,000 (vencido 10 días)
🟢 Luz $1,200, Internet $900 (vencen en 20 días)
🟠 Proveedor B $10,900 (vence en 45 días)
⚪ Mantenimiento $3,000 (vence en 60 días)
⚪ Publicidad $10,000 (vence en 90 días)

ACCIÓN DEL DUEÑO:
1. Nómina ya está en A PAGAR (automático) = $7,000
2. Arrastra Proveedor A = +$15,000 (total $22,000)
3. Arrastra Servicios = +$2,100 (total $24,100)
4. Intenta arrastrar Proveedor B = RECHAZADO (falta $10,900)
5. Intenta arrastrar Publicidad = RECHAZADO (falta $20,900)

RESULTADO:
A PAGAR = $24,100 ✅
DESPUÉS (necesita cobrar): Proveedor B, Mantenimiento, Publicidad

RECOMENDACIÓN SISTEMA:
"Cubriste lo indispensable ($7k nómina) + urgentes ($17,1k)
Falta: Cobrar a Cliente A para pagar Proveedor B ($10,900)"
```

### **EJEMPLO 2: Empresa con Problema**

```
ESTADO INICIAL:

Flujo próximos 30 días: $25,000  ← PROBLEMA
- Cobranza comprometida: $15,000
- Otros ingresos: $10,000
- Gastos programados: $35,000  ← GASTO > INGRESO

ADEUDOS:
🔴 Nómina $7,000 (hoy)
🟡 Proveedor A $15,000 (vencido)
🟢 Servicios $2,100 (vence pronto)
🟠 Proveedor B $10,900 (vence pronto)
...resto...

SISTEMA VALIDA:
Nómina automáticamente en A PAGAR = $7,000
¿Flujo suficiente?
$25,000 - $7,000 = $18,000 disponible

DUEÑO ARRASTRA:
1. Proveedor A = +$15,000 (total $22,000)
2. Servicios = +$2,100 (total $24,100)
3. Intenta Proveedor B = RECHAZADO (solo $900 disponible)

ALERTA CRÍTICA:
🔴 "PROBLEMA: Flujo insuficiente para pagos"
"Nómina cubierta ✅ pero debes elegir:"
"❌ Opción 1: Atrasar pago a Proveedor B"
"❌ Opción 2: Pedir anticipo a Cliente X"
"❌ Opción 3: Solicitar crédito de emergencia"
```

---

## 🏗️ ARQUITECTURA TÉCNICA

### **Base de Datos**

```sql
-- Tabla: gastos_a_pagar
CREATE TABLE gastos_a_pagar (
  id UUID PRIMARY KEY,
  empresa_id UUID,
  descripcion TEXT,
  monto NUMERIC(15,2),
  vencimiento DATE,
  
  -- Clasificación
  tipo VARCHAR(50), -- NÓMINA, PROVEEDOR, SERVICIOS, etc
  urgencia VARCHAR(20), -- INDISPENSABLE, URGENTE, NORMAL, OPCIONAL
  color_codigo VARCHAR(20), -- ROJO, NARANJA, VERDE, GRIS
  
  -- Validación
  es_indispensable BOOLEAN DEFAULT FALSE,
  
  -- Estado
  estado VARCHAR(20), -- PENDIENTE, SELECCIONADO, PAGADO
  fecha_pago DATE,
  
  creado_en TIMESTAMP
);

-- Tabla: plan_pagos (Lo que el dueño seleccionó)
CREATE TABLE plan_pagos (
  id UUID PRIMARY KEY,
  empresa_id UUID,
  periodo DATE, -- El mes que se está planificando
  
  -- Datos del plan
  total_adeudos NUMERIC(15,2),
  total_a_pagar NUMERIC(15,2),
  flujo_disponible NUMERIC(15,2),
  
  -- Validación
  nómina_cubierta BOOLEAN,
  urgentes_cubiertas BOOLEAN,
  flujo_suficiente BOOLEAN,
  
  -- Alertas
  alertas TEXT[],
  recomendaciones TEXT[],
  
  creado_en TIMESTAMP
);

-- Tabla: historial_selecciones (Audit trail)
CREATE TABLE historial_selecciones (
  id UUID PRIMARY KEY,
  empresa_id UUID,
  gasto_id UUID,
  accion VARCHAR(50), -- ARRASTRADO, AUTO_AÑADIDO, RECHAZADO
  timestamp TIMESTAMP
);
```

### **Edge Function: Validar Flujo**

```typescript
// Edge Function: validar-pago-flujo
// Cuando el dueño arrastra un gasto, valida si puede pagar

export const validarFlujoDePago = async (req) => {
  const { empresa_id, gasto_id, total_actual } = req.body;
  
  // 1. Obtener flujo disponible
  const flujoDisponible = await obtenerFlujoCobanza(empresa_id);
  
  // 2. Obtener gasto
  const gasto = await supabase
    .from('gastos_a_pagar')
    .select('*')
    .eq('id', gasto_id)
    .single();
  
  // 3. Validar
  const total_propuesto = total_actual + gasto.monto;
  
  if (total_propuesto > flujoDisponible) {
    return {
      validado: false,
      razón: "Flujo insuficiente",
      faltante: total_propuesto - flujoDisponible,
      acción: "RECHAZAR" // Drag vuelve a ADEUDOS
    };
  }
  
  // 4. Validar nómina cubierta
  const nómina = gastos.find(g => g.tipo === 'NÓMINA');
  const disponibleDespúes = flujoDisponible - total_propuesto;
  
  if (disponibleDespúes < nómina.monto && !incluye_nómina) {
    return {
      validado: false,
      razón: "No cubre la nómina",
      recomendación: "Añade nómina primero"
    };
  }
  
  return {
    validado: true,
    nuevo_total: total_propuesto,
    disponible_después: flujoDisponible - total_propuesto,
    estado: disponibleDespúes > 0 ? "SEGURO" : "JUSTO"
  };
};
```

### **React Component: Selector Pagos**

```typescript
export const SelectorPagosInteligente = () => {
  const [adeudos, setAdeudos] = useState([]);
  const [aDeudos, setAPagar] = useState([]);
  const [flujoDisponible, setFlujoDisponible] = useState(0);
  
  // ON MOUNT: Auto-añadir indispensables
  useEffect(() => {
    const indispensables = adeudos.filter(g => g.es_indispensable);
    setAPagar(indispensables);
  }, []);
  
  // DRAG & DROP
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    
    // Solo permitir drag de ADEUDOS → A_PAGAR
    if (source.droppableId === 'adeudos' && 
        destination.droppableId === 'aPagar') {
      
      const gasto = adeudos.find(g => g.id === draggableId);
      const totalActual = aDeudos.reduce((sum, g) => sum + g.monto, 0);
      
      // Validar en servidor
      const { validado, faltante } = await validarFlujoDePago({
        gasto_id: gasto.id,
        total_actual: totalActual
      });
      
      if (validado) {
        setAPagar([...aDeudos, gasto]);
        setAdeudos(adeudos.filter(g => g.id !== draggableId));
      } else {
        toast.error(`No hay flujo (falta $${faltante})`);
        // Rechaza el drag
      }
    }
  };
  
  return (
    <div className="selector-pagos">
      <div className="columna-1">
        <h3>ADEUDOS ({adeudos.length})</h3>
        <Droppable droppableId="adeudos">
          {adeudos.map((g, idx) => (
            <Draggable key={g.id} draggableId={g.id} index={idx}>
              <GastoCard 
                gasto={g}
                urgencia={g.urgencia}
                color={g.color_codigo}
              />
            </Draggable>
          ))}
        </Droppable>
      </div>
      
      <div className="columna-2">
        <h3>A PAGAR ({aDeudos.length})</h3>
        <Droppable droppableId="aPagar">
          {aDeudos.map((g, idx) => (
            <GastoCardSeleccionado key={g.id} gasto={g} />
          ))}
        </Droppable>
      </div>
      
      <div className="columna-3">
        <h3>VALIDACIÓN</h3>
        <ValidacionFluj adeudos={aDeudos} flujoDisponible={flujoDisponible} />
      </div>
    </div>
  );
};
```

---

## ✅ CARACTERÍSTICAS DEL COMPONENTE

```
✅ Clasificación automática por urgencia (color-coded)
✅ Indispensables se auto-añaden a A PAGAR
✅ Drag & Drop intuitivo (móvil-friendly)
✅ Validación de flujo en tiempo real
✅ Alerta si falta flujo para nómina
✅ Contador de suma automático
✅ Tooltip con explicación de por qué se rechaza
✅ Recomendaciones inteligentes ("Cobra a Cliente X")
✅ Historial de cambios (audit trail)
✅ Exportable a PDF o email
✅ Funciona offline (con localStorage)
```

---

## 📱 INTERFAZ MÓVIL

```
En móvil, drag & drop sigue siendo fluido:

┌────────────────────────────────┐
│ SELECTOR DE PAGOS              │
├────────────────────────────────┤
│ Flujo: $35,000 ✅              │
├────────────────────────────────┤
│                                │
│ ADEUDOS    →    A PAGAR        │
│ ────────────────────────────   │
│                                │
│ 🔴 Nómina     🔴 Nómina        │
│ $7,000    →→  $7,000           │
│ [Auto]                         │
│                                │
│ 🟡 Prov. A    🟡 Prov. A       │
│ $15k      →→  $15k             │
│                                │
│ 🟢 Luz        🟢 Luz           │
│ $1,2k     →→  $1,2k            │
│                                │
│ 🟢 Internet   [SIN ESPACIO]     │
│ $900      ✗                    │
│                                │
│ 🟠 Prov. B    ✓ TOTAL: $23,2k  │
│ $10,9k                         │
│ [Después]                      │
│                                │
└────────────────────────────────┘
```

---

## 🎯 INTEGRACIÓN EN OPCIÓN B

```
OPCIÓN B (FLUJO COMPLETO) INCLUYE:

✅ Proyección de caja 30 días
✅ Alertas de riesgo
✅ Cobranza prioritaria
✅ [NUEVO] SELECTOR DE PAGOS INTELIGENTE ← TE LO PEDISTE
✅ Análisis CCC
✅ Escenarios
✅ Dashboard completo

Costo total: $8k
Tiempo: 3 semanas
```

---

## 💡 POR QUÉ ESTO ES MEJOR QUE OPCIÓN A

```
OPCIÓN A (MVP):
"Aquí está tu flujo, aquí están tus gastos"
→ Dueño tiene que pensar qué pagar

OPCIÓN B CON TU COMPONENTE:
"Arrastra los gastos que puedas pagar"
→ Sistema valida y rechaza lo que no cabe
→ Dueño ve inmediatamente las implicaciones
→ Nómina protegida automáticamente

RESULTADO: Toma de decisiones en 2 minutos vs 30 minutos
```

