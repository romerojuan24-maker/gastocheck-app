// generate-export — Edge Function v1.0
// Genera un archivo de exportación contable (Excel o CSV) para una relación o rango de fechas.
//
// Input (JSON POST):
//   company_id:    string        (requerido)
//   format:        'universal_excel' | 'contpaqi' | 'aspel_coi' | 'microsip' | 'csv'
//   batch_id?:     string        (exportar relación específica)
//   date_from?:    string        YYYY-MM-DD
//   date_to?:      string        YYYY-MM-DD
//   include_items? boolean       incluir conceptos/líneas (default: true)
//
// Output (JSON):
//   ok:        boolean
//   filename:  string
//   mime:      string
//   content:   string  (base64 para xlsx, UTF-8 texto para csv/txt)
//   encoding:  'base64' | 'utf8'
//   row_count: number

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return (n ?? 0).toFixed(2);
}
function fmtDate(s: string | null | undefined): string {
  return s ? s.slice(0, 10) : '';
}
function csvRow(cells: (string | number | null)[]): string {
  return cells.map((c) => {
    const v = c == null ? '' : String(c);
    // CSV escaping: envolvar en comillas si contiene especiales, reemplazar comillas internas con doble comilla
    const needsQuote = v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r');
    const escaped = needsQuote ? `"${v.replace(/"/g, '""').replace(/\r?\n/g, '\\n')}"` : v;
    return escaped;
  }).join(',');
}

// ── Query receipts ─────────────────────────────────────────────────────────────

async function queryReceipts(
  supabase: ReturnType<typeof createClient>,
  company_id: string,
  batch_id: string | null,
  date_from: string | null,
  date_to:   string | null,
) {
  let q = supabase
    .from('receipts')
    .select(`
      id, receipt_date, provider_name, provider_rfc, fiscal_uuid,
      internal_folio, subtotal_amount, tax_amount, total_amount,
      payment_method, source_type, status, duplicate_status,
      ocr_confidence, created_at, uploaded_by,
      category_name:expense_categories!receipts_category_id_fkey(name),
      uploader:profiles!receipts_uploaded_by_fkey(full_name)
    `)
    .eq('company_id', company_id)
    .not('status', 'in', '(cancelled,rejected)')
    .order('receipt_date', { ascending: true });

  if (batch_id) {
    // receipts en la relación
    const { data: items } = await supabase
      .from('receipt_batch_items')
      .select('receipt_id')
      .eq('batch_id', batch_id);
    const ids = (items ?? []).map((i: any) => i.receipt_id);
    if (ids.length === 0) return [];
    q = q.in('id', ids);
  } else {
    if (date_from) q = q.gte('receipt_date', date_from);
    if (date_to)   q = q.lte('receipt_date', date_to);
  }

  const { data } = await q;
  return (data ?? []) as any[];
}

async function queryPurchaseItems(
  supabase: ReturnType<typeof createClient>,
  receiptIds: string[],
) {
  if (receiptIds.length === 0) return [];
  const { data } = await supabase
    .from('purchase_items')
    .select('receipt_id, item_name, quantity, unit, unit_price, total_price')
    .in('receipt_id', receiptIds)
    .order('receipt_id');
  return (data ?? []) as any[];
}

// Mapa receipt_id → accounting_account_code (via expenses)
async function queryAccountCodes(
  supabase: ReturnType<typeof createClient>,
  receiptIds: string[],
): Promise<Record<string, string>> {
  if (receiptIds.length === 0) return {};
  const { data } = await supabase
    .from('expenses')
    .select('receipt_id, accounting_account_code')
    .in('receipt_id', receiptIds)
    .not('accounting_account_code', 'is', null);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as any[]) {
    if (row.receipt_id && row.accounting_account_code) {
      map[row.receipt_id] = row.accounting_account_code;
    }
  }
  return map;
}

// ── Builders ───────────────────────────────────────────────────────────────────

function buildResumenSheet(receipts: any[], periodLabel: string): any[][] {
  const totalSub = receipts.reduce((s, r) => s + (r.subtotal_amount ?? r.total_amount ?? 0), 0);
  const totalIva = receipts.reduce((s, r) => s + (r.tax_amount ?? 0), 0);
  const totalAmt = receipts.reduce((s, r) => s + (r.total_amount ?? 0), 0);

  return [
    ['GastoCheck — Exportación Contable'],
    [''],
    ['Período',          periodLabel],
    ['Comprobantes',     receipts.length],
    ['Subtotal',         fmt(totalSub)],
    ['IVA',             fmt(totalIva)],
    ['Total',           fmt(totalAmt)],
    [''],
    ['Generado',        new Date().toISOString().slice(0, 19).replace('T', ' ')],
  ];
}

function buildDetalleRows(receipts: any[], accountCodes: Record<string, string> = {}): any[][] {
  const headers = [
    'Fecha', 'Proveedor', 'RFC Emisor', 'UUID CFDI',
    'Folio', 'Subtotal', 'IVA', 'Total',
    'Categoría', 'Empleado', 'Método Pago', 'Tipo', 'Estado', 'Duplicado', 'Cuenta Contable',
  ];
  const rows = receipts.map((r) => [
    fmtDate(r.receipt_date),
    r.provider_name ?? '',
    r.provider_rfc  ?? '',
    r.fiscal_uuid   ?? '',
    r.internal_folio ?? '',
    parseFloat(fmt(r.subtotal_amount ?? r.total_amount)),
    parseFloat(fmt(r.tax_amount)),
    parseFloat(fmt(r.total_amount)),
    (r.category_name as any)?.name ?? r.category_name ?? '',
    (r.uploader as any)?.full_name ?? '',
    r.payment_method ?? '',
    r.source_type    ?? '',
    r.status         ?? '',
    r.duplicate_status ?? '',
    accountCodes[r.id] ?? '',
  ]);
  return [headers, ...rows];
}

function buildPorCategoriaRows(receipts: any[]): any[][] {
  const map: Record<string, { count: number; sub: number; iva: number; total: number }> = {};
  for (const r of receipts) {
    const cat = (r.category_name as any)?.name ?? r.category_name ?? 'Sin categoría';
    if (!map[cat]) map[cat] = { count: 0, sub: 0, iva: 0, total: 0 };
    map[cat].count++;
    map[cat].sub   += r.subtotal_amount ?? r.total_amount ?? 0;
    map[cat].iva   += r.tax_amount ?? 0;
    map[cat].total += r.total_amount ?? 0;
  }
  const grandTotal = Object.values(map).reduce((s, v) => s + v.total, 0);
  const headers = ['Categoría', 'Comprobantes', 'Subtotal', 'IVA', 'Total', '% del Total'];
  const rows = Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, v]) => [
      cat, v.count,
      parseFloat(fmt(v.sub)), parseFloat(fmt(v.iva)), parseFloat(fmt(v.total)),
      grandTotal > 0 ? parseFloat(((v.total / grandTotal) * 100).toFixed(1)) : 0,
    ]);
  return [headers, ...rows];
}

function buildPorProveedorRows(receipts: any[]): any[][] {
  const map: Record<string, { rfc: string; count: number; total: number; lastDate: string }> = {};
  for (const r of receipts) {
    const key = r.provider_name ?? 'Desconocido';
    if (!map[key]) map[key] = { rfc: r.provider_rfc ?? '', count: 0, total: 0, lastDate: '' };
    map[key].count++;
    map[key].total += r.total_amount ?? 0;
    if (!map[key].lastDate || r.receipt_date > map[key].lastDate) {
      map[key].lastDate = r.receipt_date ?? '';
    }
  }
  const headers = ['Proveedor', 'RFC', 'Comprobantes', 'Total Acumulado', 'Último Ticket'];
  const rows = Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, v]) => [
      name, v.rfc, v.count, parseFloat(fmt(v.total)), fmtDate(v.lastDate),
    ]);
  return [headers, ...rows];
}

function buildConceptosRows(receipts: any[], items: any[]): any[][] {
  const receiptMap: Record<string, any> = {};
  for (const r of receipts) receiptMap[r.id] = r;
  const headers = ['Proveedor', 'Fecha', 'Concepto', 'Cantidad', 'Unidad', 'Precio Unit.', 'Total Línea'];
  const rows = items.map((i) => {
    const r = receiptMap[i.receipt_id] ?? {};
    return [
      r.provider_name ?? '',
      fmtDate(r.receipt_date),
      i.item_name ?? '',
      i.quantity  ?? '',
      i.unit      ?? '',
      parseFloat(fmt(i.unit_price)),
      parseFloat(fmt(i.total_price)),
    ];
  });
  return [headers, ...rows];
}

function buildAuditoriaRows(receipts: any[]): any[][] {
  const headers = [
    'Fecha Captura', 'Capturado Por', 'Proveedor', 'Monto',
    'Estado Duplicado', 'Confianza OCR %', 'Fuente',
  ];
  const rows = receipts.map((r) => [
    fmtDate(r.created_at),
    (r.uploader as any)?.full_name ?? '',
    r.provider_name    ?? '',
    parseFloat(fmt(r.total_amount)),
    r.duplicate_status ?? '',
    r.ocr_confidence   ?? '',
    r.source_type      ?? '',
  ]);
  return [headers, ...rows];
}

// ── Excel builder ─────────────────────────────────────────────────────────────

function buildExcel(receipts: any[], items: any[], periodLabel: string, accountCodes: Record<string, string> = {}): Uint8Array {
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, rows: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Auto column widths (rough estimate)
    ws['!cols'] = (rows[0] ?? []).map((_: any, i: number) => {
      const max = rows.reduce((m, r) => Math.max(m, String(r[i] ?? '').length), 6);
      return { wch: Math.min(max + 2, 50) };
    });
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet('Resumen',        buildResumenSheet(receipts, periodLabel));
  addSheet('Detalle',        buildDetalleRows(receipts, accountCodes));
  addSheet('Por Categoría',  buildPorCategoriaRows(receipts));
  addSheet('Por Proveedor',  buildPorProveedorRows(receipts));
  if (items.length > 0) {
    addSheet('Conceptos',    buildConceptosRows(receipts, items));
  }
  addSheet('Auditoría',      buildAuditoriaRows(receipts));

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
}

// ── CSV builders ───────────────────────────────────────────────────────────────

function buildCsvGeneric(receipts: any[]): string {
  const rows = buildDetalleRows(receipts);
  return rows.map(csvRow).join('\r\n');
}

// Cuenta contable del gasto (real del catálogo) o fallback genérico
function getGastoAccount(r: any, accountCodes: Record<string, string>): string {
  return accountCodes[r.id] ?? r._account_code ?? '600-001';
}

function buildContpaqiCsv(receipts: any[], accountCodes: Record<string, string>): string {
  // Formato CONTPAQi: póliza de diario para importar
  // Encabezado de póliza: E|Tipo|Fecha|Numero|Concepto
  // Movimiento:           D|Cuenta|ConceptoMov|Debe|Haber|FechaMov|Referencia
  const lines: string[] = [];
  let folio = 1;
  for (const r of receipts) {
    const f     = String(folio++).padStart(6, '0');
    const fecha = fmtDate(r.receipt_date);
    const rfc   = r.provider_rfc  ?? '';
    const uuid  = r.fiscal_uuid   ?? '';
    const prov  = r.provider_name ?? '';
    const sub   = fmt(r.subtotal_amount ?? r.total_amount ?? 0);
    const iva   = fmt(r.tax_amount ?? 0);
    const tot   = fmt(r.total_amount ?? 0);
    const cuentaGasto = getGastoAccount(r, accountCodes);
    // Encabezado de póliza
    lines.push(`E|E|${fecha}|${f}|COMPRA ${prov}`);
    // Cargo a cuenta de gastos
    lines.push(`D|${cuentaGasto}|Compra ${prov}|${sub}|0.00|${fecha}|${uuid}`);
    // IVA acreditable
    if (parseFloat(iva) > 0) {
      lines.push(`D|118-001|IVA Acreditable|${iva}|0.00|${fecha}|${uuid}`);
    }
    // Abono a bancos / cuentas por pagar
    lines.push(`D|200-001|Pago ${prov}|0.00|${tot}|${fecha}|${uuid}`);
  }
  return lines.join('\r\n');
}

function buildAspelCsv(receipts: any[], accountCodes: Record<string, string>): string {
  // Formato Aspel COI: importación de pólizas
  const header = csvRow(['NUMERO', 'FECHA', 'CONCEPTO', 'CUENTA', 'CARGO', 'ABONO', 'RFC_TERCERO', 'DOCTO']);
  const lines: string[] = [header];
  let num = 1;
  for (const r of receipts) {
    const n     = String(num++).padStart(6, '0');
    const fecha = fmtDate(r.receipt_date);
    const rfc   = r.provider_rfc  ?? '';
    const uuid  = r.fiscal_uuid   ?? '';
    const prov  = r.provider_name ?? '';
    const sub   = fmt(r.subtotal_amount ?? r.total_amount ?? 0);
    const iva   = fmt(r.tax_amount ?? 0);
    const tot   = fmt(r.total_amount ?? 0);
    const cuentaGasto = getGastoAccount(r, accountCodes);
    lines.push(csvRow([n, fecha, `COMPRA ${prov}`, cuentaGasto, sub, '', rfc, uuid]));
    if (parseFloat(iva) > 0) {
      lines.push(csvRow([n, fecha, 'IVA ACREDITABLE', '118-001', iva, '', rfc, uuid]));
    }
    lines.push(csvRow([n, fecha, `PAGO ${prov}`, '200-001', '', tot, rfc, uuid]));
  }
  return lines.join('\r\n');
}

function buildMicrosipTxt(receipts: any[], accountCodes: Record<string, string>): string {
  // Microsip Contabilidad: delimitado por | sin espacios
  const lines = ['TIPO|POLIZA|FECHA|CONCEPTO|CUENTA|CARGO|ABONO|RFC|UUID'];
  let pol = 1;
  for (const r of receipts) {
    const p     = String(pol++).padStart(6, '0');
    const fecha = fmtDate(r.receipt_date).replace(/-/g, '');
    const rfc   = r.provider_rfc  ?? '';
    const uuid  = r.fiscal_uuid   ?? '';
    const prov  = r.provider_name ?? '';
    const sub   = fmt(r.subtotal_amount ?? r.total_amount ?? 0);
    const iva   = fmt(r.tax_amount ?? 0);
    const tot   = fmt(r.total_amount ?? 0);
    const cuentaGasto = getGastoAccount(r, accountCodes).replace(/-/g, '');
    lines.push(`D|${p}|${fecha}|COMPRA ${prov}|${cuentaGasto}|${sub}|0.00|${rfc}|${uuid}`);
    if (parseFloat(iva) > 0) {
      lines.push(`D|${p}|${fecha}|IVA ACREDITABLE|118001|${iva}|0.00|${rfc}|${uuid}`);
    }
    lines.push(`D|${p}|${fecha}|PAGO ${prov}|200001|0.00|${tot}|${rfc}|${uuid}`);
  }
  return lines.join('\r\n');
}

// ── Handler ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const {
      company_id,
      format        = 'universal_excel',
      batch_id      = null,
      date_from     = null,
      date_to       = null,
      include_items = true,
    } = body as {
      company_id:    string;
      format:        string;
      batch_id?:     string | null;
      date_from?:    string | null;
      date_to?:      string | null;
      include_items?: boolean;
    };

    if (!company_id) {
      return Response.json({ ok: false, error: 'company_id requerido' }, { status: 400, headers: CORS });
    }

    // ── Cargar datos ──────────────────────────────────────────────────────────
    const receipts = await queryReceipts(supabase, company_id, batch_id, date_from, date_to);

    const receiptIds = receipts.map((r: any) => r.id);

    const [items, accountCodes] = await Promise.all([
      include_items && receipts.length > 0
        ? queryPurchaseItems(supabase, receiptIds)
        : Promise.resolve([]),
      queryAccountCodes(supabase, receiptIds),
    ]);

    if (receipts.length === 0) {
      return Response.json({ ok: false, error: 'Sin comprobantes para el período/relación indicado' },
        { status: 404, headers: CORS });
    }

    // Etiqueta del período
    const periodStart = batch_id ? '' : (date_from ?? receipts[0]?.receipt_date ?? '');
    const periodEnd   = batch_id ? '' : (date_to   ?? receipts[receipts.length - 1]?.receipt_date ?? '');
    const periodLabel = batch_id
      ? `Relación ${batch_id.slice(0, 8)}`
      : `${fmtDate(periodStart)} — ${fmtDate(periodEnd)}`;

    // Porcentaje de comprobantes con cuenta contable asignada (para info del usuario)
    const withAccount = receipts.filter((r: any) => accountCodes[r.id]).length;

    // ── Generar archivo ───────────────────────────────────────────────────────
    const ts       = new Date().toISOString().slice(0, 10);
    let filename   = '';
    let mime       = '';
    let content    = '';
    let encoding: 'base64' | 'utf8' = 'utf8';

    if (format === 'universal_excel') {
      const buf = buildExcel(receipts, items, periodLabel, accountCodes);
      // Convertir a base64 sin memory leak (usar chunking en lugar de String.fromCharCode(...buf))
      const bytes = new Uint8Array(buf);
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode(...chunk);
      }
      content   = btoa(binaryString);
      encoding  = 'base64';
      filename  = `gastocheck_${ts}.xlsx`;
      mime      = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    } else if (format === 'contpaqi') {
      content  = buildContpaqiCsv(receipts, accountCodes);
      filename = `contpaqi_poliza_${ts}.txt`;
      mime     = 'text/plain';

    } else if (format === 'aspel_coi') {
      content  = buildAspelCsv(receipts, accountCodes);
      filename = `aspel_coi_${ts}.csv`;
      mime     = 'text/csv';

    } else if (format === 'microsip') {
      content  = buildMicrosipTxt(receipts, accountCodes);
      filename = `microsip_${ts}.txt`;
      mime     = 'text/plain';

    } else {
      // csv genérico
      content  = buildCsvGeneric(receipts);
      filename = `gastocheck_${ts}.csv`;
      mime     = 'text/csv';
    }

    // Subir a Storage y retornar URL firmada (para descarga en móvil)
    const storagePath = `${company_id}/${filename}`;
    const fileBytes = encoding === 'base64'
      ? Uint8Array.from(atob(content), c => c.charCodeAt(0))
      : new TextEncoder().encode(content);

    const { error: upErr } = await supabase.storage
      .from('report-exports')
      .upload(storagePath, fileBytes, { contentType: mime, upsert: true });
    if (upErr) throw upErr;

    const { data: signedData, error: signErr } = await supabase.storage
      .from('report-exports')
      .createSignedUrl(storagePath, 3600);
    if (signErr || !signedData?.signedUrl) throw signErr ?? new Error('No se pudo generar URL firmada');

    return Response.json({
      ok:           true,
      filename,
      mime,
      signed_url:   signedData.signedUrl,
      row_count:    receipts.length,
      period:       periodLabel,
      with_account: withAccount,
      pct_account:  receipts.length > 0
        ? Math.round((withAccount / receipts.length) * 100)
        : 0,
    }, { headers: CORS });

  } catch (err: any) {
    console.error('generate-export error:', err);
    return Response.json({ ok: false, error: err.message ?? 'Error interno' },
      { status: 500, headers: CORS });
  }
});
