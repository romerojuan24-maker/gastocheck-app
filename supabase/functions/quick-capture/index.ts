// quick-capture — Captura no-bloqueante: crea receipt placeholder y corre OCR en background
// Input:  { company_id, employee_id, image_base64 }
// Output: { ok, receipt_id, gc_folio }  — responde en <1 seg, OCR sigue en background

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';
const ANON_KEY         = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')) ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

async function runOcrAndUpdate(receiptId: string, imageBase64: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  try {
    const ocrRes = await fetch(`${SUPABASE_URL}/functions/v1/ocr-extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      },
      body: JSON.stringify({ image_base64: imageBase64, mime_type: 'image/jpeg' }),
    });

    if (!ocrRes.ok) throw new Error(`ocr-extract ${ocrRes.status}`);
    const { data: ocr } = await ocrRes.json();
    if (!ocr) throw new Error('ocr-extract devolvió vacío');

    await supabase.from('receipts').update({
      provider_name:    ocr.providerName   ?? null,
      provider_rfc:     ocr.providerRfc    ?? null,
      receipt_date:     ocr.receiptDate    ?? new Date().toISOString().slice(0, 10),
      receipt_time:     ocr.receiptTime    ?? null,
      total_amount:     ocr.total          ?? null,
      subtotal_amount:  ocr.subtotal       ?? null,
      tax_amount:       ocr.tax            ?? null,
      discount_amount:  ocr.discount       ?? null,
      ieps_amount:      ocr.ieps           ?? null,
      ish_amount:       ocr.ish            ?? null,
      retencion_iva:    ocr.retencionIva   ?? null,
      retencion_isr:    ocr.retencionIsr   ?? null,
      fiscal_uuid:      ocr.fiscalUuid     ?? null,
      internal_folio:   ocr.internalFolio  ?? null,
      payment_method:   ocr.paymentMethod  ?? null,
      ocr_text:         ocr.fullText       ?? null,
      ocr_confidence:   ocr.confidence === 'high' ? 0.9 : ocr.confidence === 'medium' ? 0.6 : 0.3,
      extracted_json:   ocr,
      is_processing:    false,
    }).eq('id', receiptId);
  } catch (e) {
    console.error('Background OCR failed:', e);
    await supabase.from('receipts').update({ is_processing: false }).eq('id', receiptId).catch(() => {});
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { company_id, employee_id, image_base64 } = await req.json() as {
      company_id:   string;
      employee_id:  string;
      image_base64: string;
    };

    if (!company_id || !employee_id || !image_base64) {
      return Response.json(
        { error: 'company_id, employee_id e image_base64 son requeridos' },
        { status: 400, headers: CORS },
      );
    }

    // Folio correlativo
    let gc_folio: string | null = null;
    try {
      const { data } = await supabase.rpc('next_gc_folio', { p_company_id: company_id, p_type: 'receipt' });
      gc_folio = data ?? null;
    } catch { /* no bloquea */ }

    // Crear placeholder — OCR lo llenará después
    const { data: receipt, error: receiptErr } = await supabase
      .from('receipts')
      .insert({
        company_id,
        uploaded_by:      user.id,
        employee_id,
        source_type:      'photo',
        status:           'captured',
        is_processing:    true,
        duplicate_status: 'no_duplicate',
        gc_folio,
        receipt_date:     new Date().toISOString().slice(0, 10),
      })
      .select('id, gc_folio')
      .single();

    if (receiptErr || !receipt) {
      return Response.json(
        { error: receiptErr?.message ?? 'No se pudo crear el comprobante' },
        { status: 500, headers: CORS },
      );
    }

    // Registrar OCR en background — respuesta sale antes
    EdgeRuntime.waitUntil(runOcrAndUpdate(receipt.id, image_base64));

    return Response.json(
      { ok: true, receipt_id: receipt.id, gc_folio: receipt.gc_folio },
      { headers: CORS },
    );
  } catch (err: any) {
    console.error('quick-capture error:', err);
    return Response.json({ error: err.message ?? 'Error interno' }, { status: 500, headers: CORS });
  }
});
