// Edge Function: Crear comprobante con verificación anti-duplicados integrada
// Crea receipt + purchase_items + upsert supplier + crea expense en póliza
// Deploy: npx supabase functions deploy submit-receipt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface OcrLineItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
}

interface SubmitInput {
  // Empresa y empleado
  company_id:    string;
  policy_id?:    string | null;  // opcional — si no viene, el comprobante va a "Mis Comprobantes"
  employee_id:   string;

  // Archivo
  file_storage_path?: string;
  file_sha256?:       string;
  source_type:        'photo' | 'pdf' | 'xml' | 'manual';

  // Datos extraídos (puede venir de OCR o manual)
  provider_name?:  string | null;
  provider_rfc?:   string | null;
  receipt_date?:   string | null;
  receipt_time?:   string | null;
  total_amount?:    number | null;
  subtotal_amount?: number | null;
  tax_amount?:      number | null;
  discount_amount?: number | null;
  ieps_amount?:     number | null;
  ish_amount?:      number | null;
  retencion_iva?:   number | null;
  retencion_isr?:   number | null;
  fiscal_uuid?:     string | null;
  internal_folio?: string | null;
  payment_method?: string | null;
  ocr_text?:       string | null;
  ocr_confidence?: number | null;
  extracted_json?: Record<string, unknown> | null;
  line_items?:     OcrLineItem[];

  // Categorización
  category_id?:    string | null;
  cost_center_id?: string | null;
  notes?:          string | null;

  // Flota
  vehicle_id?:     string | null;
  operator_id?:    string | null;

  // Si force_save=true y hay duplicado probable (no bloqueado), guarda de todas formas
  force_save?:     boolean;
  force_reason?:   string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 });

  try {
    // Verificar JWT del usuario
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
    const input: SubmitInput = await req.json();

    const {
      company_id, policy_id = null, employee_id,
      file_storage_path, file_sha256, source_type,
      provider_name, provider_rfc, receipt_date,
      receipt_time, total_amount, subtotal_amount, tax_amount,
      discount_amount, ieps_amount, ish_amount, retencion_iva, retencion_isr,
      fiscal_uuid, internal_folio, payment_method,
      ocr_text, ocr_confidence, extracted_json, line_items,
      category_id, cost_center_id, notes,
      vehicle_id = null, operator_id = null,
      force_save = false, force_reason,
    } = input;

    if (!company_id || !employee_id) {
      return Response.json(
        { error: 'company_id y employee_id son requeridos' },
        { status: 400, headers: CORS },
      );
    }

    // 🟡 FIX BUG #18: Validar montos — no permitir negativos ni NaN
    if (total_amount !== null && total_amount !== undefined) {
      if (!Number.isFinite(total_amount) || total_amount < 0) {
        return Response.json(
          { error: 'total_amount debe ser un número positivo válido' },
          { status: 400, headers: CORS },
        );
      }
    }
    if (subtotal_amount !== null && subtotal_amount !== undefined) {
      if (!Number.isFinite(subtotal_amount) || subtotal_amount < 0) {
        return Response.json(
          { error: 'subtotal_amount debe ser un número positivo válido' },
          { status: 400, headers: CORS },
        );
      }
    }
    if (tax_amount !== null && tax_amount !== undefined) {
      if (!Number.isFinite(tax_amount) || tax_amount < 0) {
        return Response.json(
          { error: 'tax_amount debe ser un número positivo válido' },
          { status: 400, headers: CORS },
        );
      }
    }

    // ── 1. Verificar duplicados ──────────────────────────────────────────────
    let duplicateStatus: string = 'no_duplicate';
    let shouldBlock: boolean = false;
    let dupMatches: any[] = [];
    let duplicateScore: number = 0;

    try {
      const dupRes = await fetch(
        `${SUPABASE_URL}/functions/v1/check-duplicate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE}` },
          body: JSON.stringify({
            company_id,
            fiscal_uuid:   fiscal_uuid ?? null,
            file_sha256:   file_sha256 ?? null,
            provider_name: provider_name ?? null,
            provider_rfc:  provider_rfc ?? null,
            receipt_date:  receipt_date ?? null,
            total_amount:  total_amount ?? null,
            uploaded_by:   user.id,
          }),
        },
      );

      if (!dupRes.ok) {
        console.error('check-duplicate failed:', dupRes.status, await dupRes.text());
        return Response.json(
          { ok: false, error: 'Duplicate check failed. Please try again.' },
          { status: 502, headers: CORS },
        );
      }

      const dupData = await dupRes.json();
      duplicateStatus = dupData.duplicate_status ?? 'no_duplicate';
      shouldBlock = dupData.should_block ?? false;
      dupMatches = dupData.matches ?? [];
      duplicateScore = dupData.score ?? 0;

      // Reintento idempotente: devolver el comprobante ya existente sin insertar
      if (dupData.should_return === true && dupMatches[0]?.receipt_id) {
        return Response.json(
          {
            ok:               true,
            receipt_id:       dupMatches[0].receipt_id,
            gc_folio:         dupMatches[0].gc_folio ?? null,
            expense_id:       null,
            supplier_id:      null,
            duplicate_status: 'idempotent_retry',
            should_block:     false,
            force_saved:      false,
            matches:          dupMatches,
          },
          { headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }
    } catch (err) {
      console.error('check-duplicate error:', err);
      return Response.json(
        { ok: false, error: 'Duplicate check unavailable' },
        { status: 502, headers: CORS },
      );
    }

    // Si está bloqueado y no se fuerza, retornar error con info del duplicado
    if (shouldBlock && !force_save) {
      return Response.json(
        {
          ok:               false,
          blocked:          true,
          duplicate_status: duplicateStatus,
          message:          'Duplicate receipt blocked. Use force_save with reason to override.',
          matches:          dupMatches,
        },
        { status: 409, headers: CORS },
      );
    }

    // ── 2. Normalizar proveedor ──────────────────────────────────────────────
    const normalizedProvider = provider_name
      ? normalizeProvider(provider_name)
      : null;

    // ── 3. Upsert supplier (ATOMIC) ──────────────────────────────────────────
    let supplier_id: string | null = null;

    if (provider_name && normalizedProvider) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: supplier, error: supplierErr } = await supabase
        .from('suppliers')
        .upsert({
          company_id,
          normalized_name:     normalizedProvider,
          name:                provider_name,
          rfc:                 provider_rfc ?? null,
          first_purchase_date: receipt_date ?? today,
          last_purchase_date:  receipt_date ?? today,
          total_purchases:     total_amount ?? 0,
          purchase_count:      1,
        }, {
          onConflict: 'company_id,normalized_name',
        })
        .select('id')
        .single();

      if (supplierErr) {
        // No bloqueante: el ticket se guarda aunque falle el proveedor
        console.warn('Supplier upsert failed (non-blocking):', supplierErr.message);
      } else if (supplier) {
        supplier_id = supplier.id;
      }
    }

    // ── 4. Crear receipt ─────────────────────────────────────────────────────
    const receiptData = {
      company_id,
      uploaded_by:               user.id,
      employee_id,
      source_type,
      provider_name:             provider_name ?? null,
      normalized_provider_name:  normalizedProvider,
      provider_rfc:              provider_rfc ?? null,
      supplier_id,
      receipt_date:              receipt_date ?? null,
      receipt_time:              receipt_time ?? null,
      total_amount:              total_amount ?? null,
      subtotal_amount:           subtotal_amount ?? null,
      tax_amount:                tax_amount ?? null,
      discount_amount:           discount_amount ?? null,
      ieps_amount:               ieps_amount ?? null,
      ish_amount:                ish_amount ?? null,
      retencion_iva:             retencion_iva ?? null,
      retencion_isr:             retencion_isr ?? null,
      fiscal_uuid:               fiscal_uuid ?? null,
      internal_folio:            internal_folio ?? null,
      payment_method:            payment_method ?? null,
      ocr_text:                  ocr_text ?? null,
      ocr_confidence:            ocr_confidence ?? null,
      extracted_json:            extracted_json ?? null,
      file_storage_path:         file_storage_path ?? null,
      file_sha256:               file_sha256 ?? null,
      category_id:               category_id ?? null,
      cost_center_id:            cost_center_id ?? null,
      notes:                     notes ?? null,
      vehicle_id:                vehicle_id ?? null,
      operator_id:               operator_id ?? null,
      duplicate_status:          force_save && shouldBlock ? 'manually_approved_duplicate' : duplicateStatus,
      duplicate_score:           duplicateScore,
      duplicate_of_receipt_id:   dupMatches[0]?.receipt_id ?? null,
      duplicate_reason:          dupMatches[0]?.reason ?? null,
      status:                    'captured',
    };

    // Obtener folio correlativo GastoCheck antes de insertar
    let gc_folio: string | null = null;
    try {
      const { data: folioData } = await supabase
        .rpc('next_gc_folio', { p_company_id: company_id, p_type: 'receipt' });
      gc_folio = folioData ?? null;
    } catch { /* no bloquea el guardado */ }

    const { data: receipt, error: receiptErr } = await supabase
      .from('receipts')
      .insert({ ...receiptData, gc_folio })
      .select('id')
      .single();

    if (receiptErr || !receipt) {
      return Response.json(
        { ok: false, error: `Error creando comprobante: ${receiptErr?.message}` },
        { status: 500, headers: CORS },
      );
    }

    // ── 5. Guardar duplicate matches si los hay ──────────────────────────────
    if (dupMatches.length > 0) {
      const matchRows = dupMatches.map((m: Record<string, unknown>) => ({
        company_id,
        receipt_id:         receipt.id,
        matched_receipt_id: m.receipt_id,
        match_type:         m.match_type,
        match_score:        m.score,
        match_reason:       m.reason,
        resolved:           force_save,
        resolution:         force_save ? 'manually_allowed' : null,
        resolution_reason:  force_save ? force_reason : null,
        resolved_at:        force_save ? new Date().toISOString() : null,
        resolved_by:        force_save ? user.id : null,
      }));

      await supabase.from('receipt_duplicate_matches').insert(matchRows);
    }

    // ── 6. Insertar conceptos/productos (purchase_items) ────────────────────
    if (line_items && line_items.length > 0) {
      const itemRows = line_items
        .filter((item) => item.name && item.name.trim().length > 0)
        .map((item) => ({
          company_id,
          receipt_id:            receipt.id,
          item_name:             item.name.trim(),
          normalized_item_name:  normalizeProvider(item.name),
          quantity:              item.quantity ?? null,
          unit:                  item.unit ?? null,
          unit_price:            item.unitPrice ?? null,
          total_price:           item.totalPrice ?? null,
          extracted_by:          'ocr',
          confidence:            item.confidence ?? null,
        }));

      if (itemRows.length > 0) {
        await supabase.from('purchase_items').insert(itemRows);
      }
    }

    // ── 7. Crear expense en póliza (solo si se especificó policy_id) ─────────
    let expense: { id: string } | null = null;

    if (policy_id) {
      let suggestedCategory: string | null = null;
      if (!category_id && provider_name) {
        suggestedCategory = suggestCategoryFromProvider(provider_name);
      }

      const notesWithCategory = suggestedCategory
        ? `[AUTO_CATEGORY: ${suggestedCategory}] ${notes || ''}`.trim()
        : notes || null;

      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .insert({
          company_id,
          policy_id,
          spender_id:     employee_id,
          receipt_id:     receipt.id,
          provider_name:  provider_name ?? null,
          provider_rfc:   provider_rfc ?? null,
          subtotal:       subtotal_amount ?? null,
          iva:            tax_amount ?? null,
          total:          total_amount ?? 0,
          expense_date:   receipt_date ?? new Date().toISOString().slice(0, 10),
          category_id:    category_id ?? null,
          cost_center_id: cost_center_id ?? null,
          notes:          notesWithCategory,
          status:         'captured',
        })
        .select('id')
        .single();

      if (expErr) {
        console.warn('Expense creation failed (receipt was saved):', expErr.message);
      } else {
        expense = expData;
      }
    }

    // ── 8. Audit log ─────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      company_id,
      user_id:     user.id,
      entity_type: 'receipt',
      entity_id:   receipt.id,
      action:      'created',
      new_values: {
        source_type,
        provider_name,
        total_amount,
        receipt_date,
        duplicate_status: duplicateStatus,
        force_save,
      },
    });

    return Response.json(
      {
        ok:               true,
        receipt_id:       receipt.id,
        gc_folio,
        expense_id:       expense?.id ?? null,
        supplier_id,
        duplicate_status: duplicateStatus,
        should_block:     shouldBlock,
        force_saved:      force_save && shouldBlock,
        matches:          dupMatches,
      },
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('submit-receipt error:', e);
    return Response.json({ ok: false, error: String(e) }, { status: 500, headers: CORS });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

// Mapeo proveedor → categoría (de shared/src/categories.ts)
const PROVIDER_CATEGORY_MAP: [string, string][] = [
  ['PEMEX',           'Combustible'],
  ['PETRO',           'Combustible'],
  ['OXXO',            'Combustible'],
  ['SHELL',           'Combustible'],
  ['MOBIL',           'Combustible'],
  ['AUTOZONE',        'Refacciones'],
  ['REFACCION',       'Refacciones'],
  ['NAPA ',           'Refacciones'],
  ['LLANTERA',        'Llantas'],
  ['CAPUFE',          'Casetas / Peajes'],
  ['FARMACIA',        'Médicos / Farmacia'],
  ['BENAVIDES',       'Médicos / Farmacia'],
  ['HOTEL',           'Hospedaje'],
  ['WALMART',         'Papelería / Oficina'],
  ['SORIANA',         'Alimentos'],
];

function suggestCategoryFromProvider(providerName: string): string | null {
  if (!providerName) return null;
  const upper = providerName.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [pattern, category] of PROVIDER_CATEGORY_MAP) {
    if (upper.includes(pattern)) return category;
  }
  return null;
}

function normalizeProvider(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
