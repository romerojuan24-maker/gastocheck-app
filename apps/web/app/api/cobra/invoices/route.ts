import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { CobraInvoice } from '@gastocheck/shared/cobra'

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
    const clientId = searchParams.get('client_id')
    const status = searchParams.get('status')
    const overdue = searchParams.get('overdue') === 'true'

    let query = supabase
      .from('cobra_invoices')
      .select('*')
      .order('due_date', { ascending: false })

    if (companyId) query = query.eq('company_id', companyId)
    if (clientId) query = query.eq('client_id', clientId)
    if (status) query = query.eq('status', status)
    if (overdue) query = query.gt('days_overdue', 0)

    const { data, error } = await query.limit(1000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data as CobraInvoice[] }, { status: 200 })
  } catch (err) {
    console.error('[API] cobra/invoices GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
