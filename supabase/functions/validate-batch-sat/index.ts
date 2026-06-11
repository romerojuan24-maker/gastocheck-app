// validate-batch-sat — Valida todos los UUIDs de un batch contra SAT
// Llama cuando supervisores cierran la relación contable
// Input: { batch_id, company_id }
// Output: { ok, validated_count, warnings: [{uuid, reason}], blocked: [{uuid, reason}] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface ValidateInput {
  batch_id: string;
  company_id: string;
}

interface SatValidationResult {
  uuid: string;
  provider_rfc: string | null;
  total_amount: number | null;
  valid: boolean;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const input: ValidateInput = await req.json();

    // Obtener todos los receipts del batch
    const { data: batchItems, error: batchErr } = await supabase
      .from('receipt_batch_items')
      .select('receipt:receipts(id, fiscal_uuid, provider_rfc, total_amount)')
      .eq('batch_id', input.batch_id);

    if (batchErr) throw new Error(batchErr.message);

    const receipts = (batchItems ?? [])
      .map((item: any) => item.receipt)
      .filter((r: any) => r && r.fiscal_uuid);

    if (receipts.length === 0) {
      return Response.json({
        ok: true,
        batch_id: input.batch_id,
        validated_count: 0,
        warnings: [],
        blocked: [],
      }, { headers: CORS });
    }

    // Mock SAT validation (simulado)
    // En producción: llamar a API.SAT.GOB.MX
    // Por ahora: validamos formato UUID + no duplicados en el batch
    const results: SatValidationResult[] = [];
    const seenUuids = new Set<string>();
    const warnings: Array<{ uuid: string; reason: string }> = [];
    const blocked: Array<{ uuid: string; reason: string }> = [];

    for (const r of receipts) {
      const uuid = r.fiscal_uuid;

      // UUID format check (36 chars, 4 dashes)
      if (!uuid || uuid.length !== 36 || (uuid.match(/-/g) ?? []).length !== 4) {
        blocked.push({ uuid, reason: 'Formato UUID inválido' });
        continue;
      }

      // Duplicate in batch
      if (seenUuids.has(uuid)) {
        blocked.push({ uuid, reason: 'UUID duplicado en esta relación' });
        continue;
      }
      seenUuids.add(uuid);

      // In real SAT validation, would call:
      // POST https://api.sat.gob.mx/cfdi/validates
      // with { rfc, uuid, total }
      // For now: basic validation passes
      results.push({
        uuid,
        provider_rfc: r.provider_rfc,
        total_amount: r.total_amount,
        valid: true,
      });
    }

    // Update receipt records with validation status
    if (blocked.length > 0) {
      for (const item of blocked) {
        await supabase
          .from('receipts')
          .update({
            sat_validation_status: 'blocked',
            sat_validation_reason: item.reason,
          })
          .eq('fiscal_uuid', item.uuid);
      }
    }

    if (results.length > 0 && warnings.length === 0) {
      for (const r of results) {
        await supabase
          .from('receipts')
          .update({
            sat_validation_status: 'validated',
            sat_validation_at: new Date().toISOString(),
          })
          .eq('fiscal_uuid', r.uuid);
      }
    }

    return Response.json({
      ok: blocked.length === 0,
      batch_id: input.batch_id,
      validated_count: results.length,
      warnings: warnings.length > 0 ? warnings : undefined,
      blocked: blocked.length > 0 ? blocked : undefined,
    }, { headers: CORS });
  } catch (err: any) {
    console.error('Error validating batch SAT:', err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
