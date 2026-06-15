// Edge Function: Asigna comprobantes a una póliza, valida CFDI en SAT y clasifica
// Input:  { policy_id, company_id, receipt_ids: string[] }
// Output: { ok, assigned, with_cfdi, without_cfdi, sat_results }
// Deploy: npx supabase functions deploy assign-receipts-to-policy

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON,
    { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    const { policy_id, company_id, receipt_ids } =
      (await req.json()) as { policy_id: string; company_id: string; receipt_ids: string[] };

    if (!policy_id || !company_id || !receipt_ids?.length) {
      return Response.json(
        { error: 'policy_id, company_id y receipt_ids son requeridos' },
        { status: 400, headers: CORS },
      );
    }

    // Verificar que la póliza pertenece a la empresa y está abierta
    const { data: policy } = await supabase
      .from('policies')
      .select('id, company_id, status')
      .eq('id', policy_id)
      .eq('company_id', company_id)
      .eq('status', 'open')
      .maybeSingle();

    if (!policy) {
      return Response.json(
        { error: 'Póliza no encontrada o ya cerrada' },
        { status: 404, headers: CORS },
      );
    }

    // Obtener los comprobantes seleccionados
    const { data: receipts } = await supabase
      .from('receipts')
      .select('id, fiscal_uuid, provider_name, provider_rfc, total_amount, subtotal_amount, tax_amount, receipt_date, payment_method, category_id, cost_center_id, notes, employee_id')
      .eq('company_id', company_id)
      .in('id', receipt_ids);

    if (!receipts?.length) {
      return Response.json({ error: 'No se encontraron comprobantes válidos' }, { status: 404, headers: CORS });
    }

    const satResults: Record<string, { estado: string; vigente: boolean }> = {};
    let withCfdi    = 0;
    let withoutCfdi = 0;
    let assigned    = 0;

    for (const receipt of receipts) {
      let cfdiType: 'con_cfdi' | 'sin_cfdi' = 'sin_cfdi';
      let satStatus: string | null = null;

      // ── Validar CFDI en SAT si tiene UUID ──────────────────────────────────
      if (receipt.fiscal_uuid) {
        try {
          const satRes = await fetch(`${SUPABASE_URL}/functions/v1/validate-cfdi`, {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE}`,
            },
            body: JSON.stringify({
              uuid:          receipt.fiscal_uuid,
              rfc_emisor:    receipt.provider_rfc,
              total:         receipt.total_amount,
              company_id,
              receipt_id:    receipt.id,
            }),
          });

          if (satRes.ok) {
            const satData = await satRes.json();
            satResults[receipt.fiscal_uuid] = {
              estado:  satData.estado,
              vigente: satData.vigente,
            };

            if (satData.vigente) {
              cfdiType  = 'con_cfdi';
              satStatus = 'validated';
              withCfdi++;
            } else {
              // CFDI cancelado o no encontrado — se registra como sin_cfdi con advertencia
              cfdiType  = 'sin_cfdi';
              satStatus = satData.cancelado ? 'cancelled' : 'not_found';
              withoutCfdi++;
            }
          } else {
            // Error del servicio SAT — tratamos como no validado
            cfdiType    = 'con_cfdi';   // tiene UUID aunque no validado
            satStatus   = 'error';
            withCfdi++;
          }
        } catch {
          cfdiType  = 'con_cfdi';
          satStatus = 'error';
          withCfdi++;
        }
      } else {
        withoutCfdi++;
      }

      // ── Validar operador multi-empresa si aplica ──────────────────────────
      // Si la factura tiene operator_id asignado, validar que el operador está
      // registrado para trabajar en esta empresa
      if (receipt.operator_id) {
        const { data: opCompany } = await supabase
          .from('operator_companies')
          .select('id')
          .eq('operator_id', receipt.operator_id)
          .eq('company_id', company_id)
          .maybeSingle();

        if (!opCompany) {
          console.warn(
            `[operator-validation] Operador ${receipt.operator_id} no está registrado para ` +
            `empresa ${company_id}. Factura ${receipt.id} no puede asignarse.`
          );
          // No bloqueamos la creación, solo loguemos la advertencia
          // El operador puede estar compartido con otra empresa
        }
      }

      // ── Crear expense en la póliza ─────────────────────────────────────────
      const { error: expErr } = await supabase.from('expenses').insert({
        company_id,
        policy_id,
        spender_id:     receipt.employee_id ?? user.id,
        receipt_id:     receipt.id,
        provider_name:  receipt.provider_name,
        provider_rfc:   receipt.provider_rfc,
        subtotal:       receipt.subtotal_amount,
        iva:            receipt.tax_amount,
        total:          receipt.total_amount ?? 0,
        expense_date:   receipt.receipt_date ?? new Date().toISOString().slice(0, 10),
        category_id:    receipt.category_id,
        cost_center_id: receipt.cost_center_id,
        notes:          receipt.notes,
        status:         'pending_auth',  // requiere autorización de admin/dueño
      });

      if (!expErr) {
        // Actualizar status del receipt a "incluido en póliza"
        await supabase.from('receipts').update({
          status:   'submitted',
          batch_id: null,
        }).eq('id', receipt.id);

        assigned++;
      } else {
        console.warn(`Expense creation failed for receipt ${receipt.id}:`, expErr.message);
      }
    }

    return Response.json({
      ok:           true,
      assigned,
      with_cfdi:    withCfdi,
      without_cfdi: withoutCfdi,
      sat_results:  satResults,
    }, { headers: CORS });

  } catch (e) {
    console.error('assign-receipts-to-policy error:', e);
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});
