import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type AuthCheckResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; status: number; error: string }

/**
 * Verifica el Bearer token de la request y que el usuario autenticado
 * pertenezca a `companyId` (opcionalmente con un rol permitido). Toda ruta
 * que use el service_role client para leer/escribir datos de una empresa
 * DEBE llamar esto primero — el service_role bypassa RLS por completo, así
 * que sin este check cualquier company_id enviado por el cliente sería
 * aceptado sin verificar que el llamante pertenece a esa empresa.
 */
export async function requireCompanyMember(
  req: NextRequest,
  companyId: string | null | undefined,
  allowedRoles?: string[],
): Promise<AuthCheckResult> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false, status: 401, error: 'No autorizado' }

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token)
  if (authErr || !user) return { ok: false, status: 401, error: 'Sesión inválida' }

  if (!companyId) return { ok: false, status: 400, error: 'Falta company_id' }

  const { data: mem } = await adminSupabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .maybeSingle()

  if (!mem) return { ok: false, status: 403, error: 'No perteneces a esta empresa' }
  if (allowedRoles && !allowedRoles.includes(mem.role))
    return { ok: false, status: 403, error: 'Sin permisos para esta acción' }

  return { ok: true, userId: user.id, role: mem.role }
}
