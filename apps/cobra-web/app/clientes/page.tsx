"use client"

import Link from "next/link"

export default function ClientesPage() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Volver
      </Link>
      <h1>Clientes</h1>
      <div style={{ marginTop: 40, textAlign: "center", color: "#999" }}>
        <p>Gestión centralizada de clientes</p>
        <p>Cartera, histórico de pagos, riesgo</p>
      </div>
    </div>
  )
}
