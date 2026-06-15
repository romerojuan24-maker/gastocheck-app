// Edge Function: Verificación anti-duplicados de comprobantes
// Detecta duplicados por UUID fiscal, hash de archivo, o proveedor+fecha+monto
// Deploy: npx supabase functions deploy check-duplicate

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface CheckInput {
  company_id:    string;
  fiscal_uuid?:  string | null;
  file_sha256?:  string | null;
  provider_name?: string | null;
  provider_rfc?: string | null;
  receipt_date?: string | null;  // YYYY-MM-DD
  total_amount?: number | null;
  exclude_receipt_id?: string | null;  // para actualizaciones
  uploaded_by?: string | null;
}

interface DuplicateMatch {
  receipt_id:    string;
  match_type:    string;
  score:         number;
  reason:        string;
  provider_name: string | null;
  receipt_date:  string | null;
  total_amount:  number | null;
  status:        string | null;
  gc_folio?:     string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 });

  try {
    const input: CheckInput = await req.json();
    const { company_id, fiscal_uuid, file_sha256, provider_name, provider_rfc,
            receipt_date, total_amount, exclude_receipt_id, uploaded_by } = input;

    if (!company_id) {
      return Response.json({ error: 'company_id requerido' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const matches: DuplicateMatch[] = [];

    // ── 0. Reintento idempotente: mismo usuario + proveedor + fecha + monto en 10 min ──
    if (uploaded_by && provider_name && receipt_date && total_amount != null) {
      const normalizedInput = normalizeProvider(provider_name);
      const tolerance = 0.10;
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: idemMatches } = await supabase
        .from('receipts')
        .select('id, gc_folio, provider_name, receipt_date, total_amount, status')
        .eq('uploaded_by', uploaded_by)
        .eq('normalized_provider_name', normalizedInput)
        .eq('receipt_date', receipt_date)
        .gte('total_amount', total_amount - tolerance)
        .lte('total_amount', total_amount + tolerance)
        .neq('status', 'cancelled')
        .gte('created_at', tenMinutesAgo)
        .limit(1);

      if (idemMatches && idemMatches.length > 0) {
        const r = idemMatches[0];
        matches.push({
          receipt_id:    r.id,
          match_type:    'idempotent_retry',
          score:         100,
          reason:        `Reintento idempotente: mismo usuario, proveedor "${provider_name}", fecha ${receipt_date}, monto $${total_amount}`,
          provider_name: r.provider_name,
          receipt_date:  r.receipt_date,
          total_amount:  r.total_amount,
          status:        r.status,
          gc_folio:      r.gc_folio ?? null,
        });

        return Response.json(
          {
            ok:               true,
            duplicate_status: 'idempotent_retry',
            score:            100,
            should_block:     false,
            should_return:    true,
            message:          `Reintento detectado: comprobante ya creado (${r.id})`,
            matches,
          },
          { headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── 1. Duplicado exacto por UUID CFDI (BLOQUEA siempre) ────────────────
    if (fiscal_uuid) {
      const { data: uuidMatches } = await supabase
        .from('receipts')
        .select('id, provider_name, receipt_date, total_amount, status')
        .eq('company_id', company_id)
        .eq('fiscal_uuid', fiscal_uuid.toUpperCase())
        .neq('status', 'cancelled')
        .neq('id', exclude_receipt_id ?? '00000000-0000-0000-0000-000000000000')
        .limit(3);

      if (uuidMatches && uuidMatches.length > 0) {
        for (const r of uuidMatches) {
          matches.push({
            receipt_id:    r.id,
            match_type:    'fiscal_uuid',
            score:         100,
            reason:        `UUID CFDI idéntico: ${fiscal_uuid}`,
            provider_name: r.provider_name,
            receipt_date:  r.receipt_date,
            total_amount:  r.total_amount,
            status:        r.status,
          });
        }
      }
    }

    // ── 2. Duplicado exacto por hash de archivo (BLOQUEA siempre) ──────────
    if (file_sha256 && matches.length === 0) {
      const { data: hashMatches } = await supabase
        .from('receipts')
        .select('id, provider_name, receipt_date, total_amount, status')
        .eq('company_id', company_id)
        .eq('file_sha256', file_sha256.toLowerCase())
        .neq('status', 'cancelled')
        .neq('id', exclude_receipt_id ?? '00000000-0000-0000-0000-000000000000')
        .limit(3);

      if (hashMatches && hashMatches.length > 0) {
        for (const r of hashMatches) {
          matches.push({
            receipt_id:    r.id,
            match_type:    'file_hash',
            score:         100,
            reason:        `Archivo idéntico (SHA-256: ${file_sha256.slice(0, 8)}...)`,
            provider_name: r.provider_name,
            receipt_date:  r.receipt_date,
            total_amount:  r.total_amount,
            status:        r.status,
          });
        }
      }
    }

    // ── 3. Duplicado por RFC + fecha + monto (fuerte, no bloquea) ─────────
    if (provider_rfc && receipt_date && total_amount != null && matches.length === 0) {
      const tolerance = 0.10;
      const { data: rfcMatches } = await supabase
        .from('receipts')
        .select('id, provider_name, normalized_provider_name, receipt_date, total_amount, status')
        .eq('company_id', company_id)
        .eq('provider_rfc', provider_rfc.toUpperCase())
        .eq('receipt_date', receipt_date)
        .gte('total_amount', total_amount - tolerance)
        .lte('total_amount', total_amount + tolerance)
        .neq('status', 'cancelled')
        .neq('id', exclude_receipt_id ?? '00000000-0000-0000-0000-000000000000')
        .limit(3);

      if (rfcMatches && rfcMatches.length > 0) {
        for (const r of rfcMatches) {
          matches.push({
            receipt_id:    r.id,
            match_type:    'rfc_date_amount',
            score:         92,
            reason:        `RFC ${provider_rfc}, fecha ${receipt_date}, monto $${total_amount}`,
            provider_name: r.provider_name,
            receipt_date:  r.receipt_date,
            total_amount:  r.total_amount,
            status:        r.status,
          });
        }
      }
    }

    // ── 4. Duplicado por proveedor normalizado + fecha + monto ─────────────
    if (provider_name && receipt_date && total_amount != null && matches.length === 0) {
      const normalizedInput = normalizeProvider(provider_name);
      const tolerance = 0.10;

      const { data: provMatches } = await supabase
        .from('receipts')
        .select('id, provider_name, normalized_provider_name, receipt_date, total_amount, status')
        .eq('company_id', company_id)
        .eq('normalized_provider_name', normalizedInput)
        .eq('receipt_date', receipt_date)
        .gte('total_amount', total_amount - tolerance)
        .lte('total_amount', total_amount + tolerance)
        .neq('status', 'cancelled')
        .neq('id', exclude_receipt_id ?? '00000000-0000-0000-0000-000000000000')
        .limit(3);

      if (provMatches && provMatches.length > 0) {
        for (const r of provMatches) {
          matches.push({
            receipt_id:    r.id,
            match_type:    'provider_date_amount',
            score:         88,
            reason:        `Proveedor "${provider_name}", fecha ${receipt_date}, monto $${total_amount}`,
            provider_name: r.provider_name,
            receipt_date:  r.receipt_date,
            total_amount:  r.total_amount,
            status:        r.status,
          });
        }
      }
    }

    // ── 5. Duplicado probable: mismo proveedor + monto similar en 3 días ───
    if (provider_name && receipt_date && total_amount != null && matches.length === 0) {
      const normalizedInput = normalizeProvider(provider_name);
      const tolerance = total_amount * 0.05;  // 5% de tolerancia en monto
      const dateMinus3 = addDays(receipt_date, -3);
      const datePlus3  = addDays(receipt_date, +3);

      const { data: fuzzyMatches } = await supabase
        .from('receipts')
        .select('id, provider_name, normalized_provider_name, receipt_date, total_amount, status')
        .eq('company_id', company_id)
        .eq('normalized_provider_name', normalizedInput)
        .gte('receipt_date', dateMinus3)
        .lte('receipt_date', datePlus3)
        .gte('total_amount', total_amount - tolerance)
        .lte('total_amount', total_amount + tolerance)
        .neq('status', 'cancelled')
        .neq('id', exclude_receipt_id ?? '00000000-0000-0000-0000-000000000000')
        .limit(3);

      if (fuzzyMatches && fuzzyMatches.length > 0) {
        for (const r of fuzzyMatches) {
          // Solo marcar si la fecha es distinta (si es la misma ya la habría capturado arriba)
          if (r.receipt_date !== receipt_date) {
            matches.push({
              receipt_id:    r.id,
              match_type:    'provider_date_amount',
              score:         65,
              reason:        `Proveedor similar, fecha cercana (${r.receipt_date}) y monto similar ($${r.total_amount})`,
              provider_name: r.provider_name,
              receipt_date:  r.receipt_date,
              total_amount:  r.total_amount,
              status:        r.status,
            });
          }
        }
      }
    }

    // ── Determinar status global ─────────────────────────────────────────────
    matches.sort((a, b) => b.score - a.score);

    let duplicateStatus = 'no_duplicate';
    let shouldBlock     = false;
    let message         = 'Sin duplicados detectados.';

    if (matches.length > 0) {
      const top = matches[0];
      if (top.match_type === 'fiscal_uuid' || top.match_type === 'file_hash') {
        duplicateStatus = 'blocked_duplicate';
        shouldBlock     = true;
        message         = `BLOQUEADO: ${top.reason}`;
      } else if (top.score >= 90) {
        duplicateStatus = 'strong_duplicate';
        message         = `Duplicado fuerte: ${top.reason}`;
      } else if (top.score >= 60) {
        duplicateStatus = 'possible_duplicate';
        message         = `Posible duplicado: ${top.reason}`;
      }
    }

    return Response.json(
      {
        ok: true,
        duplicate_status: duplicateStatus,
        score:            matches[0]?.score ?? 0,
        should_block:     shouldBlock,
        message,
        matches,
      },
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('check-duplicate error:', e);
    return Response.json({ ok: false, error: String(e) }, { status: 500, headers: CORS });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeProvider(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
