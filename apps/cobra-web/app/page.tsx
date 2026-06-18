"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@gastocheck/shared"

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push("/login")
    } else {
      router.push("/dashboard")
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f5f5f5",
      }}>
        <div style={{
          textAlign: "center",
          color: "#182535",
        }}>
          <h1>CobraCheck</h1>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return null
}
