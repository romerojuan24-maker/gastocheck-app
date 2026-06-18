"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@gastocheck/shared"
import { VERSION_STRING } from "@/lib/version"

export default function LoginPage() {
  const [email, setEmail] = useState("admin@test.com")
  const [password, setPassword] = useState("Test1234!")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push("/dashboard")
    } catch (err: any) {
      alert(err.message ?? "Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: "#f5f5f5",
      fontFamily: "system-ui, -apple-system, sans-serif",
      position: "relative",
    }}>
      <div style={{
        position: "absolute",
        top: 16,
        right: 16,
        backgroundColor: "#182535",
        color: "#36BF6A",
        padding: "6px 12px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: "bold",
      }}>
        {VERSION_STRING}
      </div>

      <div style={{
        backgroundColor: "#fff",
        borderRadius: 8,
        padding: 40,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: 400,
      }}>
        <h1 style={{
          textAlign: "center",
          color: "#182535",
          marginBottom: 8,
        }}>
          CobraCheck
        </h1>
        <p style={{
          textAlign: "center",
          color: "#36BF6A",
          marginBottom: 32,
          fontSize: 14,
        }}>
          Controla lo que te debes
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontSize: 14,
              fontWeight: 500,
              color: "#333",
              marginBottom: 6,
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                border: "1px solid #ddd",
                borderRadius: 6,
                boxSizing: "border-box",
                backgroundColor: "#f9f9f9",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block",
              fontSize: 14,
              fontWeight: 500,
              color: "#333",
              marginBottom: 6,
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                border: "1px solid #ddd",
                borderRadius: 6,
                boxSizing: "border-box",
                backgroundColor: "#f9f9f9",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              backgroundColor: "#182535",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: "bold",
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Iniciando..." : "Iniciar Sesión"}
          </button>
        </form>

        <p style={{
          textAlign: "center",
          fontSize: 12,
          color: "#999",
          marginTop: 16,
        }}>
          Demo: admin@test.com / Test1234!
        </p>
      </div>
    </div>
  )
}
