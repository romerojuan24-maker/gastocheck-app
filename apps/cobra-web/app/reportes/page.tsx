"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@gastocheck/shared"

interface ReporteAgencia {
  dias: string
  count: number
  total: number
  porcentaje: number
}

export default function ReportesPage() {
  const [companyId, setCompanyId] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"antiguedad" | "cobradores" | "clientes" | "pagos">("antiguedad")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompanyId()
  }, [])

  useEffect(() => {
    if (companyId) loadReporteData()
  }, [companyId, activeTab])

  const loadCompanyId = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: member } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("auth_id", session.user.id)
        .single()

      if (member) setCompanyId(member.company_id)
    } catch (err) {
      console.error("Error loading company:", err)
    }
  }

  const loadReporteData = async () => {
    try {
      setLoading(true)
      let query = supabase.from("cobra_invoices").select("*").eq("company_id", companyId)

      const { data: invoices } = await query

      if (invoices) {
        processData(invoices as any[])
      }
    } catch (err) {
      console.error("Error loading reporte:", err)
    } finally {
      setLoading(false)
    }
  }

  const processData = (invoices: any[]) => {
    const now = new Date()

    // Cartera por antigüedad
    const antiguedad = {
      "0-30": { count: 0, total: 0 },
      "30-60": { count: 0, total: 0 },
      "60-90": { count: 0, total: 0,},
      "90+": { count: 0, total: 0 },
    }

    invoices.forEach((inv) => {
      if (inv.status === "pending" || inv.status === "partial") {
        const dueDate = new Date(inv.due_date)
        const days = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        const pending = inv.total - inv.paid

        if (days <= 30) {
          antiguedad["0-30"].count++
          antiguedad["0-30"].total += pending
        } else if (days <= 60) {
          antiguedad["30-60"].count++
          antiguedad["30-60"].total += pending
        } else if (days <= 90) {
          antiguedad["60-90"].count++
          antiguedad["60-90"].total += pending
        } else {
          antiguedad["90+"].count++
          antiguedad["90+"].total += pending
        }
      }
    })

    // Tasa de pago
    const total = invoices.reduce((s, i) => s + i.total, 0)
    const pagado = invoices.reduce((s, i) => s + i.paid, 0)
    const tasaPago = total > 0 ? (pagado / total) * 100 : 0

    setData({
      antiguedad,
      tasaPago: tasaPago.toFixed(1),
      totalCartera: invoices
        .filter((i) => i.status !== "paid")
        .reduce((s, i) => s + (i.total - i.paid), 0),
      totalPagado: pagado,
    })
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Dashboard
      </Link>
      <h1 style={{ marginBottom: 32 }}>Reportes de Cobranza</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {(["antiguedad", "cobradores", "clientes", "pagos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 16px",
              background: activeTab === tab ? "#36BF6A" : "#fff",
              color: activeTab === tab ? "#fff" : "#182535",
              border: "1px solid #ddd",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: activeTab === tab ? "bold" : "normal",
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Cargando reportes...</p>
      ) : (
        <>
          {activeTab === "antiguedad" && data && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}>
              {Object.entries(data.antiguedad).map(([dias, { count, total }]: any) => (
                <div key={dias} style={{
                  background: "#fff",
                  padding: 20,
                  borderRadius: 8,
                  borderLeft: "4px solid #36BF6A",
                }}>
                  <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
                    {dias} días
                  </div>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#182535", marginBottom: 4 }}>
                    {count} facturas
                  </div>
                  <div style={{ fontSize: 14, color: "#36BF6A", fontWeight: 600 }}>
                    ${total.toLocaleString("es-MX")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "pagos" && data && (
            <div style={{ background: "#fff", padding: 24, borderRadius: 8 }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
                  Tasa de Pago
                </div>
                <div style={{ fontSize: 32, fontWeight: "bold", color: "#36BF6A" }}>
                  {data.tasaPago}%
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>Total Cartera</div>
                  <div style={{ fontSize: 20, fontWeight: "bold", color: "#182535" }}>
                    ${data.totalCartera.toLocaleString("es-MX")}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>Total Pagado</div>
                  <div style={{ fontSize: 20, fontWeight: "bold", color: "#36BF6A" }}>
                    ${data.totalPagado.toLocaleString("es-MX")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === "cobradores" || activeTab === "clientes") && (
            <div style={{ background: "#fff", padding: 24, borderRadius: 8, textAlign: "center", color: "#999" }}>
              <p>Reporte {activeTab} en desarrollo</p>
              <p style={{ fontSize: 12 }}>Datos disponibles una vez sincronizados</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
