"use client"

import Link from "next/link"

export default function ReportesPage() {
  const reportes = [
    { title: "Cartera por Antigüedad", desc: "0-30, 30-60, 60-90, 90+ días" },
    { title: "Evolución de Cartera", desc: "Histórico últimos 90 días" },
    { title: "Por Cliente", desc: "Detalle individual y comparativas" },
    { title: "Tasa de Pago", desc: "% cobrado vs. vencido" },
    { title: "Performance Cobradores", desc: "Ranking y KPIs" },
    { title: "Proyección 14 Días", desc: "Forecast de ingresos" },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Volver
      </Link>
      <h1>Reportes</h1>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: 16,
        marginTop: 24,
      }}>
        {reportes.map((r) => (
          <div key={r.title} style={{
            background: "#fff",
            padding: 20,
            borderRadius: 8,
            border: "1px solid #ddd",
          }}>
            <h3 style={{ marginBottom: 8, color: "#182535" }}>{r.title}</h3>
            <p style={{ fontSize: 12, color: "#999" }}>{r.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
