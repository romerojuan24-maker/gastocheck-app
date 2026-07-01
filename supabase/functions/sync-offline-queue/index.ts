// sync-offline-queue — Sincroniza un QueueItem enviado desde el cliente
// Input: { queueItem, user_id }
// Output: { ok: true, queueId, result } | { error }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface QueueItem {
  id: string;
  entityType: 'receipt' | 'advance_request' | 'expense';
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
  createdAt: number;
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const body = await req.json();
    const { queueItem, user_id } = body as { queueItem: QueueItem; user_id: string };

    if (!queueItem) {
      return Response.json({ error: 'Missing queueItem' }, { status: 400, headers: CORS });
    }

    let result: any = null;

    // Procesar según entityType + operation
    if (queueItem.entityType === 'receipt' && queueItem.operation === 'create') {
      const p = queueItem.payload;

      // Comprobante FISCAL (tiene UUID de CFDI, legal e irrepetible):
      // no se le asigna gc_folio — se valida que el UUID no esté ya registrado.
      // Comprobante NO FISCAL (ticket sin CFDI): se le asigna el folio correlativo
      // interno, que es el único identificador de control que tiene.
      let gc_folio: string | null = null;
      let duplicateStatus = p.duplicate_status ?? 'checked';

      if (p.fiscal_uuid) {
        const { count } = await supabase
          .from('receipts')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', p.company_id)
          .eq('fiscal_uuid', p.fiscal_uuid)
          .neq('status', 'cancelled');
        if ((count ?? 0) > 0) duplicateStatus = 'blocked_duplicate';
      } else {
        try {
          const { data: folioData } = await supabase
            .rpc('next_gc_folio', { p_company_id: p.company_id, p_type: 'receipt' });
          gc_folio = folioData ?? null;
        } catch { /* no bloquea el guardado */ }
      }

      const { data, error } = await supabase
        .from('receipts')
        .insert({
          company_id:        p.company_id,
          uploaded_by:       user_id,
          employee_id:       user_id,
          source_type:       'photo',
          provider_name:     p.provider_name,
          provider_rfc:      p.provider_rfc,
          receipt_date:      p.receipt_date,
          gc_folio,
          fiscal_uuid:       p.fiscal_uuid ?? null,
          total_amount:      p.total_amount,
          subtotal_amount:   p.subtotal ?? 0,
          tax_amount:        p.iva ?? 0,
          discount_amount:   p.descuento ?? 0,
          ieps_amount:       p.ieps ?? 0,
          ish_amount:        p.ish ?? 0,
          retencion_iva:     p.retencion_iva ?? 0,
          retencion_isr:     p.retencion_isr ?? 0,
          payment_method:    p.payment_method,
          category_id:       p.category_id,
          notes:             p.description,
          file_storage_path: p.photo_url,
          duplicate_status:  duplicateStatus,
          vehicle_id:        p.vehicle_id,
          operator_id:       p.operator_id,
          status:            'captured',
          created_at:        new Date(queueItem.createdAt).toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      result = { receipt_id: data.id, gc_folio, duplicate_status: duplicateStatus };
    } else if (queueItem.entityType === 'advance_request' && queueItem.operation === 'create') {
      const p = queueItem.payload;
      const { data, error } = await supabase
        .from('advance_requests')
        .insert({
          requester_id: user_id,
          company_id:   p.company_id,
          amount:       p.amount,
          status:       'pending',
          reason:       p.description,
          created_at:   new Date(queueItem.createdAt).toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      result = { request_id: data.id };
    } else {
      return Response.json(
        { error: `Unsupported operation: ${queueItem.entityType}/${queueItem.operation}` },
        { status: 400, headers: CORS },
      );
    }

    return Response.json(
      { ok: true, queueId: queueItem.id, result },
      { status: 200, headers: CORS },
    );
  } catch (err: any) {
    console.error('[sync-offline-queue] Error:', err);
    return Response.json(
      { error: err.message ?? 'Sync failed' },
      { status: 500, headers: CORS },
    );
  }
});
