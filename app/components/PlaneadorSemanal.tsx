'use client'

import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface PlanSemanal {
  id: string
  semana_inicio: string
  semana_fin: string
  caja_actual: number
  caja_proyectada: number
  estado: string
  actualizado_en: string
}

interface PagoSemanal {
  id: string
  plan_id: string
  descripcion: string
  monto: number
  tipo: string
  urgencia: string
  color_codigo: string
  estado: string
  dia_programado: number
  caja_permite: boolean
  fecha_vencimiento: string
}

interface IngresoEsperado {
  id: string
  cliente_nombre: string
  monto: number
  fecha_promesa: string
  recibido: boolean
  confirmado_por_cliente: boolean
}

interface Alerta {
  id: string
  tipo_alerta: string
  titulo: string
  descripcion: string
  accion_recomendada: string
}

export const PlaneadorSemanal = ({ empresaId }: { empresaId: string }) => {
  const [plan, setPlan] = useState<PlanSemanal | null>(null)
  const [pagos, setPagos] = useState<PagoSemanal[]>([])
  const [ingresos, setIngresos] = useState<IngresoEsperado[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  // CARGAR DATOS
  useEffect(() => {
    cargarDatos()

    // Subscripción a cambios en tiempo real
    const subscription = supabase
      .channel(`plan:${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_pagos_semanal',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => cargarDatos()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [empresaId])

  const cargarDatos = async () => {
    try {
      // Obtener plan activo
      const { data: planData } = await supabase
        .from('plan_pagos_semanal')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('estado', 'ACTIVA')
        .single()

      if (!planData) {
        setLoading(false)
        return
      }

      setPlan(planData)

      // Obtener pagos
      const { data: pagosData } = await supabase
        .from('pago_semanal')
        .select('*')
        .eq('plan_id', planData.id)
        .order('dia_programado', { ascending: true })

      setPagos(pagosData || [])

      // Obtener ingresos
      const { data: ingresosData } = await supabase
        .from('ingreso_semanal_esperado')
        .select('*')
        .eq('plan_id', planData.id)

      setIngresos(ingresosData || [])

      // Obtener alertas
      const { data: alertasData } = await supabase
        .from('alerta_flujo_semanal')
        .select('*')
        .eq('plan_id', planData.id)
        .eq('resuelta', false)

      setAlertas(alertasData || [])

      setLoading(false)
    } catch (error) {
      console.error('Error cargando datos:', error)
      toast.error('Error cargando planeador')
      setLoading(false)
    }
  }

  // DRAG & DROP
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result

    if (!destination) return
    if (source.droppableId === destination.droppableId) return

    const diaNuevo = parseInt(destination.droppableId.split('-')[1])
    const pago = pagos.find(p => p.id === draggableId)

    if (!pago) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/arrastrar-pago`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            pago_id: pago.id,
            dia_nuevo: diaNuevo,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Error moviendo pago')
        return
      }

      toast.success(`${pago.descripcion} movido`)
      cargarDatos()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error moviendo pago')
    }
  }

  // RENDER: DÍAS
  const dias = ['MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

  const obtenerFecha = (index: number): string => {
    if (!plan) return ''
    const inicio = new Date(plan.semana_inicio)
    const fecha = new Date(inicio)
    fecha.setDate(fecha.getDate() + index)
    return fecha.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
  }

  const obtenerPagosDia = (dia: number): PagoSemanal[] => {
    return pagos.filter(p => p.dia_programado === dia && p.estado !== 'PAGADO')
  }

  const obtenerIngresosDia = (dia: number): IngresoEsperado[] => {
    return ingresos.filter(i => {
      const fecha = new Date(i.fecha_promesa)
      return fecha.getDay() === dia + 1 || (dia === 4 && fecha.getDay() === 6)
    })
  }

  const colorClase = (color: string): string => {
    const colores: Record<string, string> = {
      ROJO: 'bg-red-50 border-red-200',
      NARANJA: 'bg-orange-50 border-orange-200',
      VERDE: 'bg-green-50 border-green-200',
      GRIS: 'bg-gray-50 border-gray-200',
    }
    return colores[color] || colores.GRIS
  }

  const alertaClase = (tipo: string): string => {
    const tipos: Record<string, string> = {
      CRÍTICA: 'bg-red-100 border-l-4 border-red-500 text-red-800',
      ALTA: 'bg-orange-100 border-l-4 border-orange-500 text-orange-800',
      MEDIA: 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800',
      BAJA: 'bg-blue-100 border-l-4 border-blue-500 text-blue-800',
    }
    return tipos[tipo] || tipos.BAJA
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No hay plan semanal activo para esta empresa</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* HEADER CON CAJA */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">📅 Planeador Semanal</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-gray-600">Caja Actual</p>
            <p className="text-2xl font-bold text-blue-900">
              ${plan.caja_actual.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Actualizado: {new Date(plan.actualizado_en).toLocaleTimeString('es-MX')}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-sm text-gray-600">Proyectada (Fin Semana)</p>
            <p className="text-2xl font-bold text-green-900">
              ${plan.caja_proyectada?.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || '0'}
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded p-4">
            <p className="text-sm text-gray-600">Período</p>
            <p className="text-lg font-bold text-purple-900">
              {new Date(plan.semana_inicio).toLocaleDateString('es-MX')} - {new Date(plan.semana_fin).toLocaleDateString('es-MX')}
            </p>
          </div>
        </div>
      </div>

      {/* ALERTAS */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-lg">🚨 Alertas Activas</h3>
          {alertas.map(alerta => (
            <div key={alerta.id} className={`rounded p-4 ${alertaClase(alerta.tipo_alerta)}`}>
              <p className="font-bold">{alerta.titulo}</p>
              <p className="text-sm mt-1">{alerta.descripcion}</p>
              {alerta.accion_recomendada && (
                <p className="text-sm mt-2 italic">💡 {alerta.accion_recomendada}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PLANEADOR DÍA A DÍA */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {dias.map((dia, idx) => {
            const pagosDia = obtenerPagosDia(idx)
            const ingresosDia = obtenerIngresosDia(idx)

            return (
              <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-lg mb-2">
                  {dia} <span className="text-xs text-gray-500">{obtenerFecha(idx)}</span>
                </h3>

                {/* INGRESOS */}
                {ingresosDia.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-gray-300">
                    {ingresosDia.map(ingreso => (
                      <div
                        key={ingreso.id}
                        className="bg-green-100 border border-green-300 rounded p-2 mb-2 text-xs"
                      >
                        <p className="font-bold text-green-900">
                          ⬆️ ${ingreso.monto.toLocaleString()}
                        </p>
                        <p className="text-green-800">{ingreso.cliente_nombre}</p>
                        <p className="text-green-700 text-xs mt-1">
                          {ingreso.recibido ? '✅ Recibido' : ingreso.confirmado_por_cliente ? '⏳ Confirmado' : '❓ Sin confirmar'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* PAGOS (Droppable) */}
                <Droppable droppableId={`dia-${idx}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-32 rounded p-2 ${
                        snapshot.isDraggingOver ? 'bg-blue-100 border-2 border-blue-400' : 'bg-white'
                      }`}
                    >
                      {pagosDia.map((pago, pagoIdx) => (
                        <Draggable key={pago.id} draggableId={pago.id} index={pagoIdx}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`border-2 rounded p-3 cursor-move transition-all ${
                                colorClase(pago.color_codigo)
                              } ${snapshot.isDragging ? 'shadow-lg rotate-3' : ''} ${
                                !pago.caja_permite ? 'opacity-50' : ''
                              }`}
                            >
                              <p className="font-bold text-sm">{pago.descripcion}</p>
                              <p className="text-lg font-bold text-gray-900">
                                ⬇️ ${pago.monto.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                {pago.estado === 'PAGADO' ? '✅ Pagado' : !pago.caja_permite ? '❌ Sin flujo' : '⏳ Pendiente'}
                              </p>
                              {!pago.caja_permite && (
                                <p className="text-xs text-red-600 mt-1 font-bold">
                                  No hay flujo para esto
                                </p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* INSTRUCCIONES */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
        <p className="font-bold mb-2">💡 Cómo usar:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Arrastra pagos entre días para reorganizar tu plan</li>
          <li>Los pagos rojos (nómina) están protegidos automáticamente</li>
          <li>Si un pago está gris, significa que no hay flujo para pagarlo</li>
          <li>Los ingresos en verde muestran dinero que esperas recibir</li>
        </ul>
      </div>
    </div>
  )
}
