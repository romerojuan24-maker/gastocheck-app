"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function CheckoutSuccessPage() {
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSubscription() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single()

        setSubscription(subs)
      }
      setLoading(false)
    }

    loadSubscription()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p>Verificando tu suscripción...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 text-center">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-3xl font-bold text-white mb-4">
          ¡Bienvenido a GastoCheck!
        </h1>
        <p className="text-slate-300 mb-6">
          Tu suscripción al plan{" "}
          <span className="font-bold text-blue-400 capitalize">
            {subscription?.plan}
          </span>{" "}
          ha sido activada.
        </p>

        <div className="bg-blue-600 bg-opacity-20 border border-blue-500 rounded-lg p-4 mb-8 text-left">
          <p className="text-slate-200 text-sm">
            <strong>Fecha de renovación:</strong>{" "}
            {new Date(subscription?.current_period_end).toLocaleDateString("es-MX")}
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            Ir al Dashboard
          </Link>
          <Link
            href="/"
            className="block w-full bg-slate-700 text-white py-3 rounded-lg font-bold hover:bg-slate-600 transition-colors"
          >
            Volver al Inicio
          </Link>
        </div>

        <p className="text-slate-400 text-xs mt-8">
          ¿Preguntas? Contacta a{" "}
          <a href="mailto:soporte@gastocheck.app" className="text-blue-400 hover:text-blue-300">
            soporte@gastocheck.app
          </a>
        </p>
      </div>
    </div>
  )
}
