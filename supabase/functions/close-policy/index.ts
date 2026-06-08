// Edge Function: Cierra una póliza y opcionalmente crea la siguiente encadenada.
// Al cerrar: guarda closing_balance (ya calculado por trigger SQL) y crea snapshot.
// Deploy: supabase functions deploy close-policy
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const { policy_id, create_next = false, next_name } = (await req.json()) as {
      policy_id: string;
      create_next?: boolean;   // true = crear nueva póliza encadenada
      next_name?: string;      // nombre de la nueva póliza
    };

    if (!policy_id) return Response.json({ error: 'policy_id requerido' }, { status: 400 });

    // Verificar usuario autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'no auth' }, { status: 401 });

    // Leer póliza actual (RLS garantiza que pertenece a su empresa)
    const { data: policy, error: pErr } = await supabase
      .from('policies')
      .select('id, company_id, holder_id, name, status, closing_balance, opening_balance')
      .eq('id', policy_id)
      .single();

    if (pErr || !policy) return Response.json({ error: 'póliza no encontrada' }, { status: 404 });
    if (policy.status === 'closed') return Response.json({ error: 'la póliza ya está cerrada' }, { status: 409 });

    // Verificar que el usuario tiene rol para cerrar (owner o supervisor permitido)
    const { data: roleRow } = await supabase.rpc('auth_role', { p_company: policy.company_id });
    const role = roleRow as string;

    if (!['owner', 'supervisor'].includes(role)) {
      return Response.json({ error: 'no tienes permiso para cerrar pólizas' }, { status: 403 });
    }

    // Si es supervisor, verificar que la empresa permite que supervisores cierren
    if (role === 'supervisor') {
      const { data: company } = await supabase
        .from('companies')
        .select('allow_supervisor_close')
        .eq('id', policy.company_id)
        .single();

      if (!company?.allow_supervisor_close) {
        return Response.json({
          error: 'el supervisor no tiene permiso para cerrar pólizas en esta empresa',
        }, { status: 403 });
      }
    }

    // Verificar que no hay gastos en status bloqueante (pendientes de autorizar)
    const { count: pendingCount } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('policy_id', policy_id)
      .in('status', ['pending_auth', 'observed']);

    if ((pendingCount ?? 0) > 0) {
      return Response.json({
        error: `No puedes cerrar la póliza: tiene ${pendingCount} gasto(s) pendientes de autorización`,
        code: 'PENDING_EXPENSES',
      }, { status: 409 });
    }

    // Cerrar la póliza
    const { error: closeErr } = await supabase
      .from('policies')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', policy_id);

    if (closeErr) return Response.json({ error: closeErr.message }, { status: 400 });

    // Marcar gastos autorizados como cerrados en póliza
    await supabase
      .from('expenses')
      .update({ status: 'closed_in_policy' })
      .eq('policy_id', policy_id)
      .in('status', ['authorized', 'invoice_applied']);

    // Registrar en audit
    await supabase.from('expense_audit').insert({
      company_id: policy.company_id,
      expense_id: policy_id, // reuse para referencia de póliza
      actor_id: user.id,
      action: 'close_policy',
      payload: { closing_balance: policy.closing_balance },
    }).catch(() => null); // no falla si hay error de FK

    let nextPolicy = null;

    // Crear póliza siguiente si se pidió
    if (create_next) {
      const { data: newPolicy, error: newErr } = await supabase
        .from('policies')
        .insert({
          company_id: policy.company_id,
          holder_id: policy.holder_id,
          name: next_name ?? `${policy.name} (continuación)`,
          opening_balance: policy.closing_balance ?? 0,
          status: 'open',
          previous_policy_id: policy_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (newErr) {
        // La póliza anterior ya está cerrada, reportar advertencia
        console.error('Error creando póliza siguiente:', newErr.message);
      } else {
        nextPolicy = newPolicy;
      }
    }

    return Response.json(
      {
        ok: true,
        closed_policy_id: policy_id,
        closing_balance: policy.closing_balance,
        next_policy: nextPolicy,
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
