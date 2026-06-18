"use client"

import Link from "next/link"

export default function CampanasPage() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Volver
      </Link>
      <h1>Campañas WhatsApp</h1>
      <div style={{ marginTop: 40, textAlign: "center", color: "#999" }}>
        <p>Funcionalidad de campañas WhatsApp en desarrollo</p>
        <p>Crea y automatiza recordatorios de pago</p>
      </div>
    </div>
  )
}
