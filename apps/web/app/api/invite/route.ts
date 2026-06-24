import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Verificar sesión del invitante
    const { data: { user: caller }, error: authErr } = await adminSupabase.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

    const { email, role, company_id } = await req.json()
    if (!email || !role || !company_id) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

    // Verificar que el invitante es owner/admin de esa empresa
    const { data: mem } = await adminSupabase
      .from('company_members')
      .select('role')
      .eq('user_id', caller.id)
      .eq('company_id', company_id)
      .maybeSingle()

    if (!mem || !['owner', 'admin'].includes(mem.role))
      return NextResponse.json({ error: 'Sin permisos para invitar' }, { status: 403 })

    // Buscar si el usuario ya existe en Auth
    const { data: existingList } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = existingList?.users?.find(u => u.email === email)

    let userId: string

    if (existing) {
      userId = existing.id
      // Verificar si ya es miembro
      const { data: alreadyMember } = await adminSupabase
        .from('company_members')
        .select('user_id')
        .eq('user_id', userId)
        .eq('company_id', company_id)
        .maybeSingle()
      if (alreadyMember) return NextResponse.json({ error: 'Este usuario ya es miembro de la empresa' }, { status: 409 })
    } else {
      // Crear usuario con contraseña temporal + enviar magic link
      const { data: created, error: createErr } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback?next=/configuracion`,
        data: { company_id, role },
      })
      if (createErr || !created?.user) return NextResponse.json({ error: createErr?.message ?? 'Error al crear usuario' }, { status: 500 })
      userId = created.user.id
    }

    // Insertar membresía
    const { error: insErr } = await adminSupabase.from('company_members').insert({
      company_id,
      user_id: userId,
      role,
      status: existing ? 'active' : 'invited',
    })

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, userId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
