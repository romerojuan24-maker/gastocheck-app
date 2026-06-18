"use client"

import { useState } from "react"
import Link from "next/link"

interface Campana {
  id: string
  nombre: string
  fecha: string
  estado: "draft" | "enviada" | "completada"
  respuestas: number
  total_clientes: number
}

export default function CampanasPage() {
  const [campanas] = useState<Campana[]>([
    {
      id: "1",
      nombre: "Recordatorio de pago vencidos >60 días",
      fecha: "2026-06-15",
      estado: "completada",
      respuestas: 24,
      total_clientes: 45,
    },
    {
      id: "2",
      nombre: "Promesas de pago mes anterior",
      fecha: "2026-06-10",
      estado: "enviada",
      respuestas: 18,
      total_clientes: 38,
    },
  ])

  const [showCrear, setShowCrear] = useState(false)
  const [nueva, setNueva] = useState({
    nombre: "",
    mensaje: "",
    filtro: "vencidas",
  })

  const getEstadoBadge = (estado: string) => {
    const colors: any = {
      draft: "#999",
      enviada: "#36BF6A",
      completada: "#22c55e",
    }
    const labels: any = {
      draft: "Borrador",
      enviada: "Enviada",
      completada: "Completada",
    }
    return (
      <span
        style={{
          background: colors[estado],
          color: "#fff",
          padding: "4px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: "bold",
        }}
      >
        {labels[estado]}
      </span>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Dashboard
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1>Campañas WhatsApp</h1>
        <button
          onClick={() => setShowCrear(!showCrear)}
          style={{
            padding: "10px 16px",
            background: "#36BF6A",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          + Crear Campaña
        </button>
      </div>

      {showCrear && (
        <div
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 8,
            marginBottom: 24,
            border: "1px solid #ddd",
          }}
        >
          <h3 style={{ marginBottom: 16 }}>Nueva Campaña</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 6 }}>
                Nombre
              </label>
              <input
                type="text"
                value={nueva.nombre}
                onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
                placeholder="Ej: Recordatorio de pago"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 6 }}>
                Mensaje WhatsApp
              </label>
              <textarea
                value={nueva.mensaje}
                onChange={(e) => setNueva({ ...nueva, mensaje: e.target.value })}
                placeholder="Tu mensaje aquí..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                  minHeight: 100,
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 6 }}>
                Filtro
              </label>
              <select
                value={nueva.filtro}
                onChange={(e) => setNueva({ ...nueva, filtro: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <option value="vencidas">Vencidas > 30 días</option>
                <option value="vencidas60">Vencidas > 60 días</option>
                <option value="promesas">Promesas de pago</option>
                <option value="todos">Todos los clientes</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowCrear(false)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "#f0f0f0",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "#36BF6A",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {campanas.map((c) => (
          <div
            key={c.id}
            style={{
              background: "#fff",
              padding: 16,
              borderRadius: 8,
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: "#182535", marginBottom: 4 }}>
                {c.nombre}
              </div>
              <div style={{ fontSize: 12, color: "#999" }}>{c.fecha}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>Respuestas</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#36BF6A" }}>
                {c.respuestas}/{c.total_clientes}
              </div>
            </div>
            <div>{getEstadoBadge(c.estado)}</div>
            <div>
              <button
                style={{
                  padding: "8px 12px",
                  background: "#182535",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Ver
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
