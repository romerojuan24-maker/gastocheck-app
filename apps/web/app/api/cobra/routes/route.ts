import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { CobraRoute } from '@gastocheck/shared/cobra'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const actorId = searchParams.get('actor_id')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = supabase
      .from('cobra_routes')
      .select('*')
      .order('assigned_date', { ascending: false })

    if (companyId) query = query.eq('company_id', companyId)
    if (actorId) query = query.eq('actor_id', actorId)
    if (status) query = query.eq('status', status)
    if (dateFrom) query = query.gte('assigned_date', dateFrom)
    if (dateTo) query = query.lte('assigned_date', dateTo)

    const { data, error } = await query.limit(1000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data as CobraRoute[] }, { status: 200 })
  } catch (err) {
    console.error('[API] cobra/routes GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validar que supervisor/admin está creando la ruta (no el cobrador)
    const { data: member } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', body.company_id)
      .single()

    if (!member || !['owner', 'admin', 'supervisor', 'superadmin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Only supervisors/admin can create routes' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('cobra_routes')
      .insert([body])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[API] cobra/routes POST error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
