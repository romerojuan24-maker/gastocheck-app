import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '',
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface ApproveRequest {
  viatico_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const auth = req.headers.get('authorization');
    const token = auth?.replace('Bearer ', '');
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
    }

    // Verificar token y obtener usuario
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    }

    const body: ApproveRequest = await req.json();
    const { viatico_id, action, rejection_reason } = body;

    if (!viatico_id || !action) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400, headers: CORS },
      );
    }

    // Obtener viático
    const { data: viatico, error: viaErr } = await supabase
      .from('viaticos')
      .select('*, company_id')
      .eq('id', viatico_id)
      .single();

    if (viaErr || !viatico) {
      return Response.json({ error: 'Viatico not found' }, { status: 404, headers: CORS });
    }

    // Verificar que el usuario es supervisor de la empresa
    const { data: member, error: memErr } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', viatico.company_id)
      .single();

    if (memErr || !member || !['admin', 'supervisor'].includes(member.role)) {
      return Response.json(
        { error: 'Not authorized to approve viaticos' },
        { status: 403, headers: CORS },
      );
    }

    // Actualizar viático
    const { error: updateErr } = await supabase
      .from('viaticos')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: action === 'reject' ? rejection_reason : null,
      })
      .eq('id', viatico_id);

    if (updateErr) throw updateErr;

    // Log de auditoría
    console.log(
      `[approve-viatico] ${action.toUpperCase()} viatico ${viatico_id} by ${user.id} for company ${viatico.company_id}`,
    );

    return Response.json(
      {
        ok: true,
        viatico_id,
        action,
        message: action === 'approve' ? 'Viático aprobado' : 'Viático rechazado',
      },
      { status: 200, headers: CORS },
    );
  } catch (err) {
    console.error('[approve-viatico] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Approval failed' },
      { status: 500, headers: CORS },
    );
  }
});
