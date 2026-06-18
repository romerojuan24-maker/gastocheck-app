"use client"

import Link from "next/link"

export default function CobradoresPage() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Volver
      </Link>
      <h1>Cobradores</h1>
      <div style={{ marginTop: 40, textAlign: "center", color: "#999" }}>
        <p>Gestión de cobradores en campo</p>
        <p>KPIs, rutas, estadísticas diarias</p>
      </div>
    </div>
  )
}
