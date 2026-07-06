import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_ROLES = ['admin', 'accountant', 'supervisor', 'buyer', 'spender', 'collector', 'viewer']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

  const body = await req.json()
  const { role, company_id } = body as { role: string; company_id: string }

  if (!role || !company_id) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })

  // Verificar que quien llama es owner/admin de esa empresa
  const { data: caller } = await adminSupabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', company_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!caller || !['owner', 'admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos para cambiar roles' }, { status: 403 })
  }

  // No se puede cambiar el rol de uno mismo
  if (userId === user.id) {
    return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
  }

  const { error } = await adminSupabase
    .from('company_members')
    .update({ role })
    .eq('user_id', userId)
    .eq('company_id', company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
