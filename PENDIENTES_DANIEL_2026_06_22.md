# 📋 GUÍA PARA DANIEL: PENDIENTES 2026-06-22

**Para:** Daniel (Desarrollador)  
**Fecha:** Mañana, 2026-06-22  
**Tiempo Total:** 6-8 horas  
**Objetivo:** Completar OPCIÓN B al 100%

---

## ✅ ESTADO ACTUAL (COMPLETADO ANOCHE)

```
✅ SQL: 100% (8 tablas, 6 funciones, 6 triggers)
✅ Edge Functions: 100% (6 funciones Deno)
✅ PlaneadorSemanal.tsx: 100% (componente principal)
✅ package.json: 100% (dependencias)
✅ Deploy Guide: 100% (pasos 1-6)

TODO EN: /gastocheck-app/
```

---

## 🔴 PENDIENTES PARA MAÑANA (6-8 horas)

### 1️⃣ PASO 1: Deploy SQL en Supabase (30 min)

**Archivo:** `sql/20260621_opcion_b_tablas_completas.sql`

```bash
# Opción A: Copiar-pegar en Supabase SQL Editor
1. Ir a: https://app.supabase.com
2. SQL Editor → New Query
3. Copiar TODO: sql/20260621_opcion_b_tablas_completas.sql
4. Pegar en editor
5. Click "Run"
6. Esperar: "OPCIÓN B CREADA ✅"

# Opción B: CLI (si ya tienes Supabase CLI)
supabase db push

# Verificar
SELECT COUNT(*) FROM plan_pagos_semanal;
SELECT COUNT(*) FROM pago_semanal;
SELECT COUNT(*) FROM alerta_flujo_semanal;
```

**Checklist:**
- [ ] SQL ejecutado sin errores
- [ ] 8 tablas creadas
- [ ] 6 funciones PL/pgSQL creadas
- [ ] 6 triggers creados
- [ ] RLS policies activas

---

### 2️⃣ PASO 2: Deploy Edge Functions (45 min)

**Archivos:** `supabase/functions/*`

```bash
# 1. Instalar/Login
supabase login

# 2. Deploy todas
supabase functions deploy

# O individualmente
supabase functions deploy actualizar-flujo-semanal
supabase functions deploy crear-plan-semanal
supabase functions deploy arrastrar-pago
supabase functions deploy calcular-escenarios-what-if
supabase functions deploy generar-alertas-inteligentes
supabase functions deploy calcular-scoring-cobranza

# 3. Verificar
supabase functions list

# 4. Test
curl -X POST https://[TU-PROYECTO].supabase.co/functions/v1/crear-plan-semanal \
  -H "Content-Type: application/json" \
  -d '{"empresa_id": "test", "caja_inicial": 50000}'
```

**Checklist:**
- [ ] 6 functions deployed sin errores
- [ ] Todas listadas en `supabase functions list`
- [ ] Test curl retorna 201
- [ ] No hay errores en logs

---

### 3️⃣ PASO 3: Instalar Dependencias (10 min)

```bash
# Desde raíz del proyecto
npm install

# Verifica que se instaló todo
npm list react-beautiful-dnd
npm list @supabase/supabase-js
npm list recharts
npm list react-hot-toast
```

**Checklist:**
- [ ] npm install completado
- [ ] Todas las dependencias instaladas
- [ ] node_modules creada
- [ ] package-lock.json actualizado

---

### 4️⃣ PASO 4: Crear Componentes React (3 horas)

Falta crear 4 componentes secundarios. **Están 80% documentados, solo necesitan código:**

#### **COMPONENTE 1: AlertasResumen.tsx** (40 min)

**Ubicación:** `app/components/AlertasResumen.tsx`

```typescript
'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

interface Alerta {
  id: string
  tipo_alerta: string
  titulo: string
  descripcion: string
  accion_recomendada: string
}

export const AlertasResumen = ({ empresaId }: { empresaId: string }) => {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  useEffect(() => {
    cargarAlertas()
  }, [empresaId])

  const cargarAlertas = async () => {
    const { data: planActivo } = await supabase
      .from('plan_pagos_semanal')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('estado', 'ACTIVA')
      .single()

    if (!planActivo) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('alerta_flujo_semanal')
      .select('*')
      .eq('plan_id', planActivo.id)
      .eq('resuelta', false)
      .order('tipo_alerta', { ascending: false })

    setAlertas(data || [])
    setLoading(false)
  }

  const alertaIcon = (tipo: string) => {
    const iconos: Record<string, string> = {
      CRÍTICA: '🔴',
      ALTA: '🟠',
      MEDIA: '🟡',
      BAJA: '⚪',
    }
    return iconos[tipo] || '⚪'
  }

  if (loading) return <div>Cargando alertas...</div>

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-lg">🚨 Alertas Activas</h3>
      
      {alertas.length === 0 ? (
        <div className="bg-green-100 border border-green-300 rounded p-4 text-green-800">
          ✅ Sin alertas. Todo está bajo control.
        </div>
      ) : (
        alertas.map(alerta => (
          <div
            key={alerta.id}
            className="bg-red-50 border border-red-200 rounded p-4"
          >
            <p className="font-bold">
              {alertaIcon(alerta.tipo_alerta)} {alerta.titulo}
            </p>
            <p className="text-sm mt-1 text-gray-700">{alerta.descripcion}</p>
            {alerta.accion_recomendada && (
              <p className="text-sm mt-2 italic text-gray-600">
                💡 {alerta.accion_recomendada}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}
```

**Checklist:**
- [ ] Componente crea en `app/components/AlertasResumen.tsx`
- [ ] Conecta a Supabase
- [ ] Carga alertas de BD
- [ ] Muestra iconos por tipo
- [ ] Renderiza sin errores

---

#### **COMPONENTE 2: GraficoFlujo30Dias.tsx** (50 min)

**Ubicación:** `app/components/GraficoFlujo30Dias.tsx`

```typescript
'use client'

import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createClient } from '@supabase/supabase-js'

export const GraficoFlujo30Dias = ({ empresaId }: { empresaId: string }) => {
  const [datos, setDatos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  useEffect(() => {
    cargarDatos()
  }, [empresaId])

  const cargarDatos = async () => {
    const { data } = await supabase
      .from('proyeccion_flujo_30dias')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      // Crear datos para gráfico (simulación día a día)
      const datosGrafico = Array.from({ length: 30 }, (_, i) => {
        const proporcion = i / 30
        return {
          fecha: `Día ${i + 1}`,
          caja: Math.round(
            data.caja_inicio +
            (data.ingresos_esperados * proporcion) -
            (data.egresos_esperados * proporcion)
          ),
        }
      })

      setDatos(datosGrafico)
    }

    setLoading(false)
  }

  if (loading) return <div>Cargando gráfico...</div>

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-bold text-lg mb-4">📈 Proyección 30 Días</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="fecha" />
          <YAxis />
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
          <Line
            type="monotone"
            dataKey="caja"
            stroke="#3b82f6"
            name="Caja Proyectada"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Checklist:**
- [ ] Componente creado
- [ ] Usa Recharts LineChart
- [ ] Carga datos de BD
- [ ] Gráfico renderiza sin errores
- [ ] Muestra línea de caja proyectada

---

#### **COMPONENTE 3: CobranzaPrioritaria.tsx** (50 min)

**Ubicación:** `app/components/CobranzaPrioritaria.tsx`

```typescript
'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

interface Cliente {
  cliente_rfc: string
  cliente_nombre: string
  puntaje_riesgo: number
  prioridad_cobranza: string
  historial_retrasos: number
  promedio_dias_retraso: number
}

export const CobranzaPrioritaria = ({ empresaId }: { empresaId: string }) => {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  useEffect(() => {
    cargarClientes()
  }, [empresaId])

  const cargarClientes = async () => {
    const { data } = await supabase
      .from('scoring_cliente_cobranza')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('puntaje_riesgo', { ascending: false })

    setClientes(data || [])
    setLoading(false)
  }

  const colorPrioridad = (prioridad: string) => {
    const colores: Record<string, string> = {
      URGENTE: 'bg-red-100 text-red-900 border-red-300',
      ALTA: 'bg-orange-100 text-orange-900 border-orange-300',
      NORMAL: 'bg-blue-100 text-blue-900 border-blue-300',
      BAJA: 'bg-green-100 text-green-900 border-green-300',
    }
    return colores[prioridad] || colores.NORMAL
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="text-left p-4">Cliente</th>
            <th className="text-center p-4">Riesgo</th>
            <th className="text-center p-4">Prioridad</th>
            <th className="text-center p-4">Retrasos</th>
            <th className="text-center p-4">Días Promedio</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map(cliente => (
            <tr key={cliente.cliente_rfc} className="border-b hover:bg-gray-50">
              <td className="p-4">
                <p className="font-bold">{cliente.cliente_nombre}</p>
                <p className="text-xs text-gray-500">{cliente.cliente_rfc}</p>
              </td>
              <td className="text-center p-4">
                <span className="text-sm font-bold">{cliente.puntaje_riesgo}/100</span>
              </td>
              <td className="text-center p-4">
                <span className={`px-3 py-1 rounded border ${colorPrioridad(cliente.prioridad_cobranza)}`}>
                  {cliente.prioridad_cobranza}
                </span>
              </td>
              <td className="text-center p-4">{cliente.historial_retrasos}</td>
              <td className="text-center p-4">
                {cliente.promedio_dias_retraso.toFixed(1)} días
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {clientes.length === 0 && (
        <div className="p-4 text-center text-gray-500">
          No hay clientes registrados
        </div>
      )}
    </div>
  )
}
```

**Checklist:**
- [ ] Componente creado
- [ ] Tabla HTML renderiza
- [ ] Carga scoring de clientes
- [ ] Ordena por riesgo (descendente)
- [ ] Colores por prioridad

---

#### **COMPONENTE 4: SimuladorEscenarios.tsx** (40 min)

**Ubicación:** `app/components/SimuladorEscenarios.tsx`

```typescript
'use client'

import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

export const SimuladorEscenarios = ({ empresaId, planId }: { empresaId: string; planId: string }) => {
  const [nombre, setNombre] = useState('')
  const [clientePerdido, setClientePerdido] = useState(0)
  const [gastosAdicionales, setGastosAdicionales] = useState(0)
  const [ingresosAdicionales, setIngresosAdicionales] = useState(0)
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  const simular = async () => {
    if (!nombre) {
      toast.error('Ingresa nombre del escenario')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/calcular-escenarios-what-if`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            plan_id: planId,
            nombre_escenario: nombre,
            cliente_perdido_monto: clientePerdido,
            gastos_adicionales: gastosAdicionales,
            ingresos_adicionales: ingresosAdicionales,
          }),
        }
      )

      const data = await response.json()
      setResultado(data.escenario)
      toast.success('Escenario simulado')
    } catch (error) {
      toast.error('Error simulando escenario')
    }

    setLoading(false)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-bold text-lg mb-4">🤔 Simulador: ¿Qué Si...?</h3>

      <div className="space-y-4 mb-6">
        <input
          type="text"
          placeholder="Nombre del escenario (ej: Pierdo Cliente A)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full border rounded p-2"
        />

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600">Cliente Perdido ($)</label>
            <input
              type="number"
              value={clientePerdido}
              onChange={(e) => setClientePerdido(Number(e.target.value))}
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Gastos Adicionales ($)</label>
            <input
              type="number"
              value={gastosAdicionales}
              onChange={(e) => setGastosAdicionales(Number(e.target.value))}
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Ingresos Adicionales ($)</label>
            <input
              type="number"
              value={ingresosAdicionales}
              onChange={(e) => setIngresosAdicionales(Number(e.target.value))}
              className="w-full border rounded p-2"
            />
          </div>
        </div>

        <button
          onClick={simular}
          disabled={loading}
          className="w-full bg-blue-500 text-white rounded p-2 hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Simulando...' : 'Simular Escenario'}
        </button>
      </div>

      {resultado && (
        <div className={`rounded p-4 ${resultado.es_viable ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
          <p className="font-bold mb-2">{resultado.nombre_escenario}</p>
          <p className="text-sm">
            Caja original: <span className="font-bold">${resultado.caja_proyectada_original.toLocaleString()}</span>
          </p>
          <p className="text-sm">
            Caja en escenario: <span className="font-bold">${resultado.caja_proyectada_escenario.toLocaleString()}</span>
          </p>
          <p className="text-sm mt-2">
            Diferencia: <span className={`font-bold ${resultado.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${resultado.diferencia.toLocaleString()}
            </span>
          </p>
          <p className="text-sm mt-2">
            {resultado.es_viable ? '✅ Es viable' : '❌ No es viable'}
          </p>
        </div>
      )}
    </div>
  )
}
```

**Checklist:**
- [ ] Componente creado
- [ ] Formulario con 3 inputs
- [ ] Botón "Simular"
- [ ] Llama a Edge Function
- [ ] Muestra resultado

---

### 5️⃣ PASO 5: Crear Página Dashboard (1 hora)

**Ubicación:** `app/pages/flujo-efectivo.tsx` o `app/flujo-efectivo/page.tsx`

```typescript
'use client'

import React from 'react'
import { PlaneadorSemanal } from '@/app/components/PlaneadorSemanal'
import { AlertasResumen } from '@/app/components/AlertasResumen'
import { GraficoFlujo30Dias } from '@/app/components/GraficoFlujo30Dias'
import { CobranzaPrioritaria } from '@/app/components/CobranzaPrioritaria'
import { SimuladorEscenarios } from '@/app/components/SimuladorEscenarios'
import { useUser } from '@supabase/auth-helpers-react'

export default function FlujoEfectivoPage() {
  const user = useUser()

  if (!user) {
    return <div>Cargando...</div>
  }

  // Obtener empresa_id del usuario
  // (Asumiendo que está en sesión o metadata)
  const empresaId = user?.user_metadata?.empresa_id || 'test-empresa'

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">💰 Flujo de Efectivo Integrado</h1>
        <p className="text-gray-600">Control semanal actualizado en tiempo real</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SECCIÓN PRINCIPAL: Planeador Semanal */}
        <div className="lg:col-span-3">
          <PlaneadorSemanal empresaId={empresaId} />
        </div>

        {/* SIDEBAR DERECJA: Alertas */}
        <div>
          <AlertasResumen empresaId={empresaId} />
        </div>
      </div>

      {/* SECCIÓN 2: Proyección 30 Días */}
      <div className="mt-8">
        <GraficoFlujo30Dias empresaId={empresaId} />
      </div>

      {/* SECCIÓN 3: Cobranza */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">📊 Cobranza Prioritaria</h2>
        <CobranzaPrioritaria empresaId={empresaId} />
      </div>

      {/* SECCIÓN 4: Simulador */}
      <div className="mt-8">
        <SimuladorEscenarios empresaId={empresaId} planId="current-plan" />
      </div>
    </div>
  )
}
```

**Checklist:**
- [ ] Página creada
- [ ] Importa 5 componentes
- [ ] Layout responsivo
- [ ] Obtiene empresa_id del usuario
- [ ] Renderiza sin errores

---

### 6️⃣ PASO 6: Testing Local (1 hora)

```bash
# 1. Instalar dependencias (si no lo hizo)
npm install

# 2. Crear .env.local
# NEXT_PUBLIC_SUPABASE_URL=[tu URL]
# NEXT_PUBLIC_SUPABASE_ANON_KEY=[tu KEY]

# 3. Ejecutar dev
npm run dev

# 4. Navegar a
http://localhost:3000/flujo-efectivo

# 5. Tests
```

**Tests a pasar:**
- [ ] Página carga sin errores
- [ ] PlaneadorSemanal renderiza
- [ ] AlertasResumen muestra alertas
- [ ] GraficoFlujo renderiza
- [ ] CobranzaPrioritaria muestra tabla
- [ ] SimuladorEscenarios funciona
- [ ] Drag & drop funciona
- [ ] Actualización tiempo real funciona

---

### 7️⃣ PASO 7: Build & Deploy (30 min)

```bash
# 1. Build
npm run build

# Debe terminar sin errores

# 2. Deploy (elige uno)

# VERCEL (Recomendado)
vercel

# O GITHUB PAGES
git add -A
git commit -m "Deploy OPCIÓN B completa"
git push origin main

# O DOCKER
docker build -t gastocheck-opcion-b .
docker run -p 3000:3000 gastocheck-opcion-b
```

**Checklist:**
- [ ] Build successful
- [ ] Deployed sin errores
- [ ] URL accesible
- [ ] Funcionalidades operativas

---

## 📊 RESUMEN PENDIENTES

| Tarea | Tiempo | Archivo |
|-------|--------|---------|
| 1. Deploy SQL | 30 min | `sql/20260621_opcion_b_tablas_completas.sql` |
| 2. Deploy Edge Functions | 45 min | `supabase/functions/*` |
| 3. Instalar dependencias | 10 min | `npm install` |
| 4.1 AlertasResumen.tsx | 40 min | `app/components/` |
| 4.2 GraficoFlujo30Dias.tsx | 50 min | `app/components/` |
| 4.3 CobranzaPrioritaria.tsx | 50 min | `app/components/` |
| 4.4 SimuladorEscenarios.tsx | 40 min | `app/components/` |
| 5. Dashboard page | 1 hora | `app/flujo-efectivo/page.tsx` |
| 6. Testing local | 1 hora | `npm run dev` |
| 7. Build & Deploy | 30 min | `npm run build` |
| **TOTAL** | **6-8 horas** | |

---

## ✅ CHECKLIST FINAL

```
MORNING (09:00):
[ ] Lee esta guía completa
[ ] Verifica que tienes acceso a Supabase
[ ] Verifica que tienes Node.js 18+

MIDDAY (13:00):
[ ] PASO 1: Deploy SQL ✅
[ ] PASO 2: Deploy Edge Functions ✅
[ ] PASO 3: Instalar dependencias ✅

AFTERNOON (15:00):
[ ] PASO 4.1-4.4: Crear componentes React ✅
[ ] PASO 5: Dashboard page ✅
[ ] PASO 6: Testing local ✅

END OF DAY (17:00):
[ ] PASO 7: Build & Deploy ✅
[ ] OPCIÓN B EN PRODUCCIÓN 🎉
```

---

## 📞 SI NECESITA AYUDA

**Issues comunes:**

1. **Error: "Edge Function not found"**
   → `supabase functions deploy` de nuevo

2. **Error: "Cannot find module"**
   → `npm install` y limpia node_modules

3. **Error: "Supabase credentials invalid"**
   → Verifica .env.local

4. **Error: "RLS policy denies access"**
   → Verifica que tabla enterprise_usuarios existe

---

## 🎯 OBJETIVO FINAL

```
🎉 OPCIÓN B 100% OPERATIVA EN PRODUCCIÓN

✅ SQL: 8 tablas + 6 funciones + 6 triggers
✅ Edge Functions: 6 endpoints operativos
✅ React: 5 componentes + Dashboard
✅ Testing: Todos los tests pasando
✅ Deploy: En producción

Usuarios pueden:
✅ Ver planeador semanal
✅ Drag & drop pagos
✅ Ver alertas automáticas
✅ Simular escenarios
✅ Ver scoring de cobranza
✅ Visualizar flujo 30 días
```

---

**Éxito mañana, Daniel! 🚀**

