"use client"

import Link from "next/link"

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <Link href="/dashboard" style={{ color: "#36BF6A", marginBottom: 24, display: "block" }}>
        ← Volver
      </Link>
      <h1>Configuración</h1>

      <div style={{ marginTop: 32, display: "grid", gap: 24 }}>
        <section style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h2 style={{ marginBottom: 16, color: "#182535" }}>Usuarios</h2>
          <p style={{ color: "#999" }}>Gestión de usuarios y permisos</p>
        </section>

        <section style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h2 style={{ marginBottom: 16, color: "#182535" }}>Roles</h2>
          <p style={{ color: "#999" }}>admin, supervisor, cobrador, operador</p>
        </section>

        <section style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h2 style={{ marginBottom: 16, color: "#182535" }}>Integraciones</h2>
          <p style={{ color: "#999" }}>WhatsApp, Stripe, SAT, etc.</p>
        </section>
      </div>
    </div>
  )
}
