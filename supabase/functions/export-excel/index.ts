// Edge Function: Genera Excel clasificado de una póliza.
// Hojas: Resumen, Por Empleado, Por Categoría, Por Centro de Costo, Detalle.
// Deploy: supabase functions deploy export-excel
import { createClient } from 'jsr:@supabase/supabase-js@2';
import ExcelJS from 'npm:exceljs@4.4.0';

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
    const { policy_id } = (await req.json()) as { policy_id: string };
    if (!policy_id) return Response.json({ error: 'policy_id requerido' }, { status: 400 });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'no auth' }, { status: 401 });

    // Leer póliza
    const { data: policy } = await supabase
      .from('policies')
      .select('id, name, company_id, holder_id, opening_balance, closing_balance, period_start, period_end, status')
      .eq('id', policy_id)
      .single();

    if (!policy) return Response.json({ error: 'póliza no encontrada' }, { status: 404 });

    // Leer gastos con datos relacionados
    const { data: expenses } = await supabase
      .from('expenses')
      .select(`
        id, provider_name, provider_rfc, subtotal, iva, total,
        expense_date, status, notes, authorized_at,
        spender:profiles!expenses_spender_id_fkey(full_name),
        authorizer:profiles!expenses_authorized_by_fkey(full_name),
        category:expense_categories(name),
        cost_center:cost_centers(name),
        cfdi:cfdi_data(uuid, rfc_emisor, fecha, metodo_pago)
      `)
      .eq('policy_id', policy_id)
      .not('status', 'in', '(deleted,duplicate)')
      .order('expense_date', { ascending: true });

    const rows = expenses ?? [];
    const money = (n: number | null) => n ?? 0;
    const fmt = (n: number) => n.toFixed(2);

    // ── Construir Excel ──────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GastoCheck';
    wb.created = new Date();

    const NAVY = 'FF0D1B2A';
    const WHITE = 'FFFFFFFF';
    const GREEN = 'FF43A047';
    const ORANGE = 'FFFF9800';
    const GRAY = 'FFF5F7FA';

    const headerStyle = (ws: ExcelJS.Worksheet, row: number, cols: number) => {
      for (let c = 1; c <= cols; c++) {
        const cell = ws.getCell(row, c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
        cell.alignment = { horizontal: 'center' };
      }
    };

    // ── Hoja 1: Resumen ──────────────────────────────────────────
    const wsRes = wb.addWorksheet('Resumen');
    wsRes.columns = [{ width: 30 }, { width: 20 }];

    const totalAdvances = policy.opening_balance;
    const totalAuth = rows
      .filter((e) => ['authorized', 'invoice_applied', 'closed_in_policy'].includes(e.status))
      .reduce((s, e) => s + money(e.total), 0);
    const totalPending = rows
      .filter((e) => ['captured', 'pending_auth', 'observed'].includes(e.status))
      .reduce((s, e) => s + money(e.total), 0);
    const closing = money(policy.closing_balance);

    [
      ['GastoCheck — Resumen de Póliza', ''],
      ['', ''],
      ['Póliza', policy.name],
      ['Periodo', `${policy.period_start ?? ''} → ${policy.period_end ?? ''}`],
      ['Estado', policy.status === 'closed' ? 'Cerrada' : 'Abierta'],
      ['', ''],
      ['Saldo inicial', fmt(totalAdvances)],
      ['Total gastos autorizados', fmt(totalAuth)],
      ['Total por comprobar', fmt(totalPending)],
      ['Saldo disponible', fmt(closing)],
    ].forEach(([k, v], i) => {
      wsRes.addRow([k, v]);
      if (i === 0) {
        wsRes.getRow(1).font = { bold: true, size: 14, color: { argb: NAVY } };
      }
    });

    // ── Hoja 2: Detalle de Gastos ────────────────────────────────
    const wsDet = wb.addWorksheet('Detalle');
    wsDet.columns = [
      { header: 'Fecha', key: 'fecha', width: 13 },
      { header: 'Proveedor', key: 'proveedor', width: 25 },
      { header: 'RFC Proveedor', key: 'rfc', width: 16 },
      { header: 'Empleado', key: 'empleado', width: 20 },
      { header: 'Categoría', key: 'categoria', width: 18 },
      { header: 'Centro', key: 'centro', width: 18 },
      { header: 'Subtotal', key: 'subtotal', width: 12 },
      { header: 'IVA', key: 'iva', width: 10 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Estatus', key: 'estatus', width: 20 },
      { header: 'UUID CFDI', key: 'uuid', width: 40 },
      { header: 'Notas', key: 'notas', width: 25 },
    ];
    headerStyle(wsDet, 1, 12);

    rows.forEach((e) => {
      const row = wsDet.addRow({
        fecha: e.expense_date ?? '',
        proveedor: e.provider_name ?? '',
        rfc: e.provider_rfc ?? (e.cfdi?.rfc_emisor ?? ''),
        empleado: (e.spender as any)?.full_name ?? '',
        categoria: (e.category as any)?.name ?? '',
        centro: (e.cost_center as any)?.name ?? '',
        subtotal: money(e.subtotal),
        iva: money(e.iva),
        total: money(e.total),
        estatus: e.status,
        uuid: (e.cfdi as any)?.uuid ?? '',
        notas: e.notes ?? '',
      });

      // Color por estatus
      const colorMap: Record<string, string> = {
        authorized: GREEN,
        invoice_applied: 'FF2E7D32',
        closed_in_policy: 'FF1565C0',
        pending_auth: ORANGE,
        rejected: 'FFE53935',
        observed: 'FFFFB300',
      };
      const color = colorMap[e.status];
      if (color) {
        row.getCell('estatus').font = { color: { argb: color }, bold: true };
      }
    });

    // Fila de totales
    const totalRow = wsDet.addRow({
      fecha: 'TOTALES',
      subtotal: rows.reduce((s, e) => s + money(e.subtotal), 0),
      iva: rows.reduce((s, e) => s + money(e.iva), 0),
      total: rows.reduce((s, e) => s + money(e.total), 0),
    });
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };

    // ── Hoja 3: Por Empleado ─────────────────────────────────────
    const wsEmp = wb.addWorksheet('Por Empleado');
    wsEmp.columns = [
      { header: 'Empleado', key: 'empleado', width: 25 },
      { header: 'Gastos', key: 'count', width: 10 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Autorizados', key: 'auth', width: 14 },
      { header: 'Pendientes', key: 'pend', width: 14 },
    ];
    headerStyle(wsEmp, 1, 5);

    const byEmp = new Map<string, { count: number; total: number; auth: number; pend: number }>();
    rows.forEach((e) => {
      const name = (e.spender as any)?.full_name ?? 'Sin nombre';
      const cur = byEmp.get(name) ?? { count: 0, total: 0, auth: 0, pend: 0 };
      cur.count++;
      cur.total += money(e.total);
      if (['authorized', 'invoice_applied', 'closed_in_policy'].includes(e.status)) cur.auth += money(e.total);
      if (['captured', 'pending_auth', 'observed'].includes(e.status)) cur.pend += money(e.total);
      byEmp.set(name, cur);
    });
    byEmp.forEach((v, k) => {
      wsEmp.addRow({ empleado: k, count: v.count, total: v.total, auth: v.auth, pend: v.pend });
    });

    // ── Hoja 4: Por Categoría ────────────────────────────────────
    const wsCat = wb.addWorksheet('Por Categoría');
    wsCat.columns = [
      { header: 'Categoría', key: 'cat', width: 25 },
      { header: 'Gastos', key: 'count', width: 10 },
      { header: 'Total', key: 'total', width: 14 },
    ];
    headerStyle(wsCat, 1, 3);

    const byCat = new Map<string, { count: number; total: number }>();
    rows.forEach((e) => {
      const name = (e.category as any)?.name ?? 'Sin categoría';
      const cur = byCat.get(name) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += money(e.total);
      byCat.set(name, cur);
    });
    byCat.forEach((v, k) => {
      wsCat.addRow({ cat: k, count: v.count, total: v.total });
    });

    // ── Hoja 5: Por Centro de Costo ──────────────────────────────
    const wsCc = wb.addWorksheet('Por Centro');
    wsCc.columns = [
      { header: 'Centro de Costo', key: 'cc', width: 25 },
      { header: 'Gastos', key: 'count', width: 10 },
      { header: 'Total', key: 'total', width: 14 },
    ];
    headerStyle(wsCc, 1, 3);

    const byCc = new Map<string, { count: number; total: number }>();
    rows.forEach((e) => {
      const name = (e.cost_center as any)?.name ?? 'Sin centro';
      const cur = byCc.get(name) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += money(e.total);
      byCc.set(name, cur);
    });
    byCc.forEach((v, k) => {
      wsCc.addRow({ cc: k, count: v.count, total: v.total });
    });

    // ── Generar buffer y subir a Storage ────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `poliza_${policy.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const storagePath = `${policy.company_id}/exports/${fileName}`;

    const { error: upErr } = await supabase.storage
      .from('report-exports')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    let signedUrl: string | null = null;
    if (!upErr) {
      const { data: signed } = await supabase.storage
        .from('report-exports')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // expira en 7 días
      signedUrl = signed?.signedUrl ?? null;
    }

    // Registrar export
    await supabase.from('report_exports').insert({
      company_id: policy.company_id,
      kind: 'excel',
      storage_path: storagePath,
      signed_url: signedUrl,
      params: { policy_id },
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return Response.json(
      { ok: true, signed_url: signedUrl, file_name: fileName, rows: rows.length },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
