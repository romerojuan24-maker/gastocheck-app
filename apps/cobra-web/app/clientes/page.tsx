"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@gastocheck/shared"
import { CobraClient } from "@gastocheck/shared"

export default function ClientesPage() {
  const [clients, setClients] = useState<CobraClient[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<"todos" | "riesgo_alto" | "vencidos">("todos")

  useEffect(() => {
    loadClients()
  }, [filtro])

  const loadClients = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: member } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("auth_id", session.user.id)
        .single()

      if (!member) return

      let query = supabase
        .from("cobra_clients")
        .select("*")
        .eq("company_id", member.company_id)

      if (filtro === "riesgo_alto") {
        query = query.gte("risk_score", 70)
      } else if (filtro === "vencidos") {
        query = query.in("status", ["inactive", "blacklist"])
      }

      const { data } = await query

      setClients(data || [])
    } catch (err) {
      console.error("Error loading clients:", err)
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (score: number) => {
    if (score >= 80) return "#ef4444"
    if (score >= 60) return "#f97316"
    if (score >= 40) return "#fbbf24"
    return "#22c55e"
  }

  const getStatusLabel = (status: string) => {
    const labels: any = {
      active: "Activo",
      inactive: "Inactivo",
      blacklist: "Bloqueado",
    }
    return labels[status] || status
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Dashboard
      </Link>

      <h1 style={{ marginBottom: 24 }}>Clientes ({clients.length})</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {(["todos", "riesgo_alto", "vencidos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: "10px 16px",
              background: filtro === f ? "#36BF6A" : "#fff",
              color: filtro === f ? "#fff" : "#182535",
              border: "1px solid #ddd",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: filtro === f ? "bold" : "normal",
            }}
          >
            {f === "todos" ? "Todos" : f === "riesgo_alto" ? "Riesgo Alto" : "Bloqueados"}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Cargando clientes...</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {clients.map((client) => (
            <div
              key={client.id}
              style={{
                background: "#fff",
                padding: 16,
                borderRadius: 8,
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: 16,
                borderLeft: `4px solid ${getRiskColor(client.risk_score)}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "#182535", marginBottom: 4 }}>
                  {client.name}
                </div>
                <div style={{ fontSize: 12, color: "#999" }}>
                  {client.phone} • {getStatusLabel(client.status)}
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                  Saldo
                </div>
                <div style={{ fontSize: 16, fontWeight: "bold", color: "#182535" }}>
                  ${client.current_balance.toLocaleString("es-MX")}
                </div>
              </div>

              <div
                style={{
                  background: getRiskColor(client.risk_score),
                  color: "#fff",
                  padding: "8px 12px",
                  borderRadius: 4,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 10 }}>Riesgo</div>
                <div style={{ fontSize: 14, fontWeight: "bold" }}>
                  {client.risk_score}
                </div>
              </div>

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
                Ver
              </button>
            </div>
          ))}

          {clients.length === 0 && (
            <div style={{ textAlign: "center", color: "#999", paddingTop: 40 }}>
              <p>No hay clientes con este filtro</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
