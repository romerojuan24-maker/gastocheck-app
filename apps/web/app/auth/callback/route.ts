import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Maneja magic links de invitación y OAuth callbacks
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/hoy'
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Magic link flow (inviteUserByEmail genera token_hash)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    if (!error && data.user) {
      // Activar membresía si estaba como 'invited'
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )
      await adminSupabase
        .from('company_members')
        .update({ status: 'active' })
        .eq('user_id', data.user.id)
        .eq('status', 'invited')

      // Determinar ruta según rol
      const { data: member } = await adminSupabase
        .from('company_members')
        .select('role')
        .eq('user_id', data.user.id)
        .eq('status', 'active')
        .maybeSingle()

      const role = member?.role ?? 'buyer'
      const homeRoutes: Record<string, string> = {
        owner: '/hoy', admin: '/hoy',
        accountant: '/pendientes', supervisor: '/pendientes',
        buyer: '/gastocheck', spender: '/gastocheck', collector: '/gastocheck', viewer: '/gastocheck',
      }
      const home = homeRoutes[role] ?? '/gastocheck'
      return NextResponse.redirect(`${origin}${home}`)
    }
  }

  // OAuth / PKCE code flow
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Fallback: si algo falló, manda al login con error
  return NextResponse.redirect(`${origin}/login?error=callback_failed`)
}
