"use client"

import { useState } from "react"
import Link from "next/link"

interface Cobrador {
  id: string
  nombre: string
  cartera_asignada: number
  cobrado_hoy: number
  cobrado_mes: number
  clientes_visitados: number
  promesas: number
  tasa_cobranza: number
}

export default function CobradoresPage() {
  const [cobradores] = useState<Cobrador[]>([
    {
      id: "1",
      nombre: "Juan Pérez",
      cartera_asignada: 125000,
      cobrado_hoy: 8500,
      cobrado_mes: 65000,
      clientes_visitados: 12,
      promesas: 3,
      tasa_cobranza: 52,
    },
    {
      id: "2",
      nombre: "María García",
      cartera_asignada: 95000,
      cobrado_hoy: 12000,
      cobrado_mes: 58000,
      clientes_visitados: 15,
      promesas: 2,
      tasa_cobranza: 61,
    },
    {
      id: "3",
      nombre: "Carlos López",
      cartera_asignada: 110000,
      cobrado_hoy: 5500,
      cobrado_mes: 42000,
      clientes_visitados: 8,
      promesas: 4,
      tasa_cobranza: 38,
    },
  ])

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Dashboard
      </Link>
      <h1 style={{ marginBottom: 32 }}>Rendimiento de Cobradores</h1>

      <div style={{ display: "grid", gap: 16 }}>
        {cobradores.map((cobrador) => (
          <div
            key={cobrador.id}
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ color: "#182535", marginBottom: 4 }}>{cobrador.nombre}</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ color: "#999", marginBottom: 2 }}>Cartera Asignada</div>
                  <div style={{ fontWeight: "bold", color: "#182535" }}>
                    ${cobrador.cartera_asignada.toLocaleString("es-MX")}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#999", marginBottom: 2 }}>Cobrado Hoy</div>
                  <div style={{ fontWeight: "bold", color: "#36BF6A" }}>
                    ${cobrador.cobrado_hoy.toLocaleString("es-MX")}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#999", marginBottom: 2 }}>Cobrado Mes</div>
                  <div style={{ fontWeight: "bold", color: "#36BF6A" }}>
                    ${cobrador.cobrado_mes.toLocaleString("es-MX")}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#999", marginBottom: 2 }}>Tasa Cobranza</div>
                  <div
                    style={{
                      fontWeight: "bold",
                      color: cobrador.tasa_cobranza >= 50 ? "#36BF6A" : "#f97316",
                    }}
                  >
                    {cobrador.tasa_cobranza}%
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                paddingTop: 12,
                borderTop: "1px solid #e0e0e0",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                  Clientes Visitados
                </div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: "#182535" }}>
                  {cobrador.clientes_visitados}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                  Promesas
                </div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: "#182535" }}>
                  {cobrador.promesas}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <button
                  style={{
                    padding: "8px 12px",
                    background: "#182535",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  Ver Detalle
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
