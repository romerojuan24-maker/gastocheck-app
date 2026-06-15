import { useEffect, useState, useCallback } from "react"
import { supabase } from "./supabase"

export interface UserSubscription {
  plan: "basico" | "profesional" | "empresarial" | null
  status: string | null
  expiresAt: Date | null
  isActive: boolean
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<UserSubscription>({
    plan: null,
    status: null,
    expiresAt: null,
    isActive: false,
  })
  const [loading, setLoading] = useState(true)

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSubscription({
          plan: null,
          status: null,
          expiresAt: null,
          isActive: false,
        })
        setLoading(false)
        return
      }

      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .single()

      if (error) {
        console.log("No active subscription found")
        setSubscription({
          plan: null,
          status: null,
          expiresAt: null,
          isActive: false,
        })
        setLoading(false)
        return
      }

      if (!subs) {
        setSubscription({
          plan: null,
          status: null,
          expiresAt: null,
          isActive: false,
        })
        setLoading(false)
        return
      }

      const expiresAt = new Date(subs.current_period_end)
      const isActive = expiresAt > new Date() && subs.status === "active"

      setSubscription({
        plan: subs.plan as any,
        status: subs.status,
        expiresAt,
        isActive,
      })
    } catch (error) {
      console.error("Error checking subscription:", error)
      setSubscription({
        plan: null,
        status: null,
        expiresAt: null,
        isActive: false,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSubscription()

    // Re-check cada 5 minutos
    const interval = setInterval(checkSubscription, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkSubscription])

  return { subscription, loading, refetch: checkSubscription }
}

// Helper function para verificar si tiene acceso a feature
export function canUseFeature(plan: string | null, feature: string): boolean {
  const features: Record<string, string[]> = {
    basico: ["receipts", "reembolsos"],
    profesional: ["receipts", "reembolsos", "polizas", "reportes"],
    empresarial: ["receipts", "reembolsos", "polizas", "reportes", "api", "sso"],
  }

  if (!plan) return false
  return features[plan]?.includes(feature) ?? false
}
