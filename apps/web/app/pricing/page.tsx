"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const PLANS = [
  {
    name: "Básico",
    plan: "basico",
    price: 10,
    icon: "📦",
    features: [
      "2 usuarios",
      "100 comprobantes/mes",
      "Reembolsos básicos",
      "Soporte por email",
    ],
  },
  {
    name: "Profesional",
    plan: "profesional",
    price: 25,
    icon: "⭐",
    features: [
      "10 usuarios",
      "Comprobantes ilimitados",
      "Pólizas + Reportes",
      "Integración contable",
      "Soporte prioritario",
    ],
    popular: true,
  },
  {
    name: "Empresarial",
    plan: "empresarial",
    price: 75,
    icon: "🚀",
    features: [
      "Usuarios ilimitados",
      "API access",
      "SSO (SAML/OAuth)",
      "Auditorías avanzadas",
      "Soporte 24/7",
      "Capacitación incluida",
    ],
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  async function handleCheckout(plan: string) {
    if (!user) {
      router.push("/login")
      return
    }

    setLoading(plan)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      })

      const result = await response.json()
      if (result.url) {
        window.location.href = result.url
      } else {
        alert("Error: " + (result.error || "No se pudo crear sesión"))
      }
    } catch (error) {
      console.error("Error:", error)
      alert("No se pudo iniciar el checkout")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Planes GastoCheck
          </h1>
          <p className="text-xl text-slate-300">
            Elige el plan perfecto para tu empresa
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.plan}
              className={`relative rounded-2xl transition-all duration-300 ${
                plan.popular
                  ? "md:scale-105 bg-gradient-to-br from-blue-600 to-blue-700 ring-2 ring-blue-400"
                  : "bg-slate-800 hover:bg-slate-750"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-400 text-slate-900 px-4 py-1 rounded-full text-sm font-bold">
                  MÁS POPULAR
                </div>
              )}

              <div className="p-8">
                <div className="text-4xl mb-3">{plan.icon}</div>
                <h2 className="text-2xl font-bold mb-2 text-white">
                  {plan.name}
                </h2>

                <div className={`text-5xl font-bold mb-2 ${
                  plan.popular ? "text-white" : "text-blue-400"
                }`}>
                  ${plan.price}
                </div>
                <p className={`mb-8 ${
                  plan.popular ? "text-blue-100" : "text-slate-400"
                }`}>
                  USD / mes
                </p>

                <button
                  onClick={() => handleCheckout(plan.plan)}
                  disabled={loading === plan.plan}
                  className={`w-full py-3 rounded-lg font-bold text-lg transition-all duration-200 mb-8 ${
                    plan.popular
                      ? "bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                      : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  }`}
                >
                  {loading === plan.plan ? "Procesando..." : "Suscribirse"}
                </button>

                <ul className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className={`flex items-start gap-3 ${
                      plan.popular ? "text-white" : "text-slate-300"
                    }`}>
                      <span className="text-green-400 font-bold text-lg">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
