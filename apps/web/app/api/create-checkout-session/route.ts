import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { plan } = await req.json()

    if (!["basico", "profesional", "empresarial"].includes(plan)) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 })
    }

    const priceIdMap: Record<string, string> = {
      basico: process.env.STRIPE_PRICE_BASICO!,
      profesional: process.env.STRIPE_PRICE_PROFESIONAL!,
      empresarial: process.env.STRIPE_PRICE_EMPRESARIAL!,
    }

    const priceId = priceIdMap[plan]
    if (!priceId) {
      return NextResponse.json({ error: "Price ID no configurado" }, { status: 500 })
    }

    // Llamar a Edge Function
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, priceId }),
      },
    )

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    // Log error internally without exposing details
    console.error("Checkout error:", {
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    })
    // Return generic error to client
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    )
  }
}
