// POST /api/checkia/detectar
// Detectar anomalías — requiere sesión válida via cookies

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { empresa_id } = body

    if (!empresa_id) {
      return new Response(JSON.stringify({ error: 'empresa_id requerido' }), { status: 400 })
    }

    // Leer token de Authorization header o de cookie de sesión
    const authHeader = request.headers.get('Authorization')
    let accessToken: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.replace('Bearer ', '')
    } else {
      // Intentar via cookie (supabase-auth-token)
      const cookieStore = cookies()
      const tokenCookie = cookieStore.get('sb-omhycwfjxynkfwywzwvz-auth-token')
      if (tokenCookie?.value) {
        try {
          const parsed = JSON.parse(tokenCookie.value)
          accessToken = parsed?.[0] ?? null
        } catch {
          // ignore parse error
        }
      }
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
    }

    // Verificar usuario con su token
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401 })
    }

    // Verificar que el usuario pertenece a la empresa
    const { data: member } = await supabaseUser
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', empresa_id)
      .maybeSingle()

    if (!member) {
      return new Response(JSON.stringify({ error: 'Sin acceso a esta empresa' }), { status: 403 })
    }

    // Llamar Edge Function con service role (server-side, nunca expuesto al cliente)
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/detectar-anomalias`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ empresa_id }),
    })

    const data = await response.json()

    if (!response.ok) throw new Error(data.error || 'Error en Edge Function')

    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
