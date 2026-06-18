"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@gastocheck/shared"
import styles from "./dashboard.module.css"

interface DashboardSummary {
  total_cartera: number
  cartera_vencida: number
  esperado_mes: number
  pagado_mes: number
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }

      loadSummary()
    } catch (err) {
      console.error("Auth error:", err)
      router.push("/login")
    }
  }

  const loadSummary = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: member } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("auth_id", session.user.id)
        .single()

      if (!member) return

      const { data } = await supabase
        .from("cobra_dashboard_summary")
        .select("*")
        .eq("company_id", member.company_id)
        .single()

      if (data) {
        setSummary(data as DashboardSummary)
      }
    } catch (err) {
      console.error("Load summary error:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className={styles.container}><p>Cargando...</p></div>
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>CobraCheck Dashboard</h1>
        <Link href="/settings" className={styles.settingsLink}>
          ⚙️ Configuración
        </Link>
      </header>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Cartera Total</div>
          <div className={styles.kpiValue}>
            ${(summary?.total_cartera || 0).toLocaleString("es-MX")}
          </div>
          <div className={styles.kpiSubtext}>MXN pendientes</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Cartera Vencida</div>
          <div className={`${styles.kpiValue} ${styles.danger}`}>
            ${(summary?.cartera_vencida || 0).toLocaleString("es-MX")}
          </div>
          <div className={styles.kpiSubtext}>Vencidas > 30 días</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Esperado Este Mes</div>
          <div className={styles.kpiValue}>
            ${(summary?.esperado_mes || 0).toLocaleString("es-MX")}
          </div>
          <div className={styles.kpiSubtext}>Por vencer en 30d</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiLabel} ${styles.success}`}>
            Pagado Este Mes
          </div>
          <div className={`${styles.kpiValue} ${styles.success}`}>
            ${(summary?.pagado_mes || 0).toLocaleString("es-MX")}
          </div>
          <div className={styles.kpiSubtext}>Últimos 30 días</div>
        </div>
      </div>

      <div className={styles.linksGrid}>
        <Link href="/reportes" className={styles.linkCard}>
          <div className={styles.linkIcon}>📊</div>
          <div className={styles.linkTitle}>Reportes</div>
          <div className={styles.linkDesc}>Análisis detallados</div>
        </Link>

        <Link href="/campanas" className={styles.linkCard}>
          <div className={styles.linkIcon}>📱</div>
          <div className={styles.linkTitle}>Campañas WhatsApp</div>
          <div className={styles.linkDesc}>Recordatorios automáticos</div>
        </Link>

        <Link href="/cobradores" className={styles.linkCard}>
          <div className={styles.linkIcon}>👥</div>
          <div className={styles.linkTitle}>Cobradores</div>
          <div className={styles.linkDesc}>Rendimiento en campo</div>
        </Link>

        <Link href="/clientes" className={styles.linkCard}>
          <div className={styles.linkIcon}>🏢</div>
          <div className={styles.linkTitle}>Clientes</div>
          <div className={styles.linkDesc}>Gestión y riesgo</div>
        </Link>
      </div>
    </div>
  )
}
