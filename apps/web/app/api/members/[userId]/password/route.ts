import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/members/[userId]/password
// Permite a un owner/admin ACTUALIZAR la contraseña de un usuario ACTIVO de SU empresa.
// Restricciones de seguridad:
//  - requiere JWT de un miembro owner/admin de la empresa;
//  - el usuario objetivo debe ser miembro ACTIVO de esa misma empresa;
//  - no permite tocar a owners (un admin no puede resetear al dueño);
//  - registra auditoría (sin guardar la contraseña).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { company_id, new_password } = (body ?? {}) as { company_id?: string; new_password?: string }
  if (!company_id || !new_password) {
    return NextResponse.json({ error: 'Faltan parámetros (company_id, new_password)' }, { status: 400 })
  }
  if (typeof new_password !== 'string' || new_password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  // 1) Quien llama debe ser owner/admin ACTIVO de la empresa
  const { data: caller } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', company_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!caller || !['owner', 'admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos para actualizar contraseñas' }, { status: 403 })
  }

  // 2) El objetivo debe ser miembro ACTIVO de la MISMA empresa
  const { data: target } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', company_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ error: 'El usuario no pertenece a tu empresa' }, { status: 404 })
  }

  // 3) Un admin no puede resetear al owner (solo un owner podría, y no a sí mismo por esta vía)
  if (target.role === 'owner' && caller.role !== 'owner') {
    return NextResponse.json({ error: 'No puedes cambiar la contraseña del propietario' }, { status: 403 })
  }

  // 4) Actualizar la contraseña vía Admin API
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: new_password })
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  // 5) Auditoría (NO se guarda la contraseña)
  await admin.from('audit_logs').insert({
    company_id,
    user_id: user.id,
    entity_type: 'auth_user',
    entity_id: userId,
    action: 'admin_password_reset',
    reason: 'Contraseña actualizada por admin/owner de la empresa',
  })

  return NextResponse.json({ ok: true })
}
