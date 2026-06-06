// Edge Function: aplica una transición de estatus a un gasto, validando rol
// y dejando registro inmutable en expense_audit.
// Deploy: supabase functions deploy authorize-expense
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { canTransition, nextStatus, type ExpenseAction } from '../../../packages/shared/src/status.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { expense_id, action } = (await req.json()) as { expense_id: string; action: ExpenseAction };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'no auth' }, { status: 401 });

  // Lee gasto (RLS asegura que solo lo ve si pertenece a su empresa)
  const { data: expense, error } = await supabase
    .from('expenses')
    .select('id, status, company_id')
    .eq('id', expense_id)
    .single();
  if (error || !expense) return Response.json({ error: 'gasto no encontrado' }, { status: 404 });

  const { data: roleRow } = await supabase.rpc('auth_role', { p_company: expense.company_id });
  const role = roleRow as 'owner' | 'supervisor' | 'spender' | 'office' | 'accountant';

  if (!canTransition(action, expense.status, role)) {
    return Response.json({ error: 'transición no permitida para tu rol' }, { status: 403 });
  }

  const to = nextStatus(action);
  const patch: Record<string, unknown> = { status: to };
  if (action === 'authorize') {
    patch.authorized_by = user.id;
    patch.authorized_at = new Date().toISOString();
  }

  const { error: upErr } = await supabase.from('expenses').update(patch).eq('id', expense_id);
  if (upErr) return Response.json({ error: upErr.message }, { status: 400 });

  await supabase.from('expense_audit').insert({
    company_id: expense.company_id,
    expense_id,
    actor_id: user.id,
    action,
    from_status: expense.status,
    to_status: to,
  });

  return Response.json({ ok: true, status: to });
});
