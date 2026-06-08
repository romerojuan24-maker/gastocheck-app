// Edge Function: Genera ZIP con Excel + XML + PDFs + tickets de una póliza.
// Deploy: supabase functions deploy export-zip
import { createClient } from 'jsr:@supabase/supabase-js@2';
import JSZip from 'npm:jszip@3.10.1';
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

  // Service role para descargar archivos de Storage sin restricciones
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Cliente del usuario (para validar permisos)
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

    // Leer póliza (RLS valida pertenencia a empresa)
    const { data: policy } = await supabase
      .from('policies')
      .select('id, name, company_id, holder_id, opening_balance, closing_balance, period_start, period_end')
      .eq('id', policy_id)
      .single();

    if (!policy) return Response.json({ error: 'póliza no encontrada' }, { status: 404 });

    // Leer gastos con adjuntos
    const { data: expenses } = await supabase
      .from('expenses')
      .select(`
        id, provider_name, provider_rfc, subtotal, iva, total,
        expense_date, status, notes,
        spender:profiles!expenses_spender_id_fkey(full_name),
        category:expense_categories(name),
        cost_center:cost_centers(name),
        cfdi:cfdi_data(uuid, rfc_emisor, fecha),
        attachments:expense_attachments(id, kind, storage_path, mime)
      `)
      .eq('policy_id', policy_id)
      .not('status', 'in', '(deleted,duplicate)')
      .order('expense_date', { ascending: true });

    const rows = expenses ?? [];

    // ── Generar Excel ────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GastoCheck';

    const NAVY = 'FF0D1B2A';
    const WHITE = 'FFFFFFFF';

    const wsDet = wb.addWorksheet('Detalle');
    wsDet.columns = [
      { header: 'Fecha', key: 'fecha', width: 13 },
      { header: 'Proveedor', key: 'proveedor', width: 25 },
      { header: 'RFC', key: 'rfc', width: 16 },
      { header: 'Empleado', key: 'empleado', width: 20 },
      { header: 'Categoría', key: 'cat', width: 18 },
      { header: 'Centro', key: 'cc', width: 18 },
      { header: 'Subtotal', key: 'subtotal', width: 12 },
      { header: 'IVA', key: 'iva', width: 10 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Estatus', key: 'estatus', width: 20 },
      { header: 'UUID CFDI', key: 'uuid', width: 40 },
    ];

    // Estilo encabezado
    wsDet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.font = { bold: true, color: { argb: WHITE } };
    });

    rows.forEach((e) => {
      wsDet.addRow({
        fecha: e.expense_date ?? '',
        proveedor: e.provider_name ?? '',
        rfc: e.provider_rfc ?? (e.cfdi as any)?.rfc_emisor ?? '',
        empleado: (e.spender as any)?.full_name ?? '',
        cat: (e.category as any)?.name ?? '',
        cc: (e.cost_center as any)?.name ?? '',
        subtotal: e.subtotal ?? 0,
        iva: e.iva ?? 0,
        total: e.total ?? 0,
        estatus: e.status,
        uuid: (e.cfdi as any)?.uuid ?? '',
      });
    });

    const excelBuffer = await wb.xlsx.writeBuffer();

    // ── Construir ZIP ────────────────────────────────────────────
    const zip = new JSZip();
    const policyName = policy.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);

    // Agregar Excel al ZIP
    zip.file(`reporte_${policyName}_${dateStr}.xlsx`, excelBuffer);

    // Descargar y agregar cada adjunto
    let xmlCount = 0, pdfCount = 0, ticketCount = 0;

    for (const expense of rows) {
      const attachments = (expense.attachments as any[]) ?? [];
      for (const att of attachments) {
        try {
          const { data: fileData, error } = await supabaseAdmin.storage
            .from('expense-attachments')
            .download(att.storage_path);

          if (error || !fileData) continue;

          const arrayBuffer = await fileData.arrayBuffer();
          const expDate = expense.expense_date ?? 'sin_fecha';
          const provider = (expense.provider_name ?? 'proveedor').replace(/\s+/g, '_').slice(0, 20);

          let folder = 'otros';
          let ext = 'bin';

          if (att.kind === 'xml' || att.mime?.includes('xml')) {
            folder = 'xml'; ext = 'xml'; xmlCount++;
          } else if (att.kind === 'pdf' || att.mime === 'application/pdf') {
            folder = 'pdf'; ext = 'pdf'; pdfCount++;
          } else if (att.kind === 'ticket' || att.mime?.includes('image')) {
            folder = 'tickets'; ext = att.mime?.includes('png') ? 'png' : 'jpg'; ticketCount++;
          }

          zip.file(`${folder}/${expDate}_${provider}_${att.id.slice(0, 8)}.${ext}`, arrayBuffer);
        } catch (_) {
          // Continuar aunque falle un archivo individual
        }
      }
    }

    // README en el ZIP
    zip.file('LEAME.txt', [
      `GastoCheck — Exportación de Póliza`,
      `Póliza: ${policy.name}`,
      `Periodo: ${policy.period_start ?? 'N/A'} → ${policy.period_end ?? 'N/A'}`,
      `Exportado: ${new Date().toLocaleString('es-MX')}`,
      ``,
      `Contenido:`,
      `  reporte_*.xlsx ............. Resumen y detalle de gastos`,
      `  xml/   ..................... ${xmlCount} facturas XML (CFDI)`,
      `  pdf/   ..................... ${pdfCount} facturas PDF`,
      `  tickets/ .................. ${ticketCount} fotos de tickets`,
      ``,
      `Total gastos: ${rows.length}`,
      `Total: $${rows.reduce((s, e) => s + (e.total ?? 0), 0).toFixed(2)} MXN`,
    ].join('\n'));

    const zipBuffer = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Subir ZIP a Storage
    const fileName = `poliza_${policyName}_${dateStr}.zip`;
    const storagePath = `${policy.company_id}/exports/${fileName}`;

    await supabaseAdmin.storage
      .from('report-exports')
      .upload(storagePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    // Generar signed URL (7 días)
    const { data: signed } = await supabaseAdmin.storage
      .from('report-exports')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    // Registrar en BD
    await supabase.from('report_exports').insert({
      company_id: policy.company_id,
      kind: 'zip',
      storage_path: storagePath,
      signed_url: signed?.signedUrl ?? null,
      params: { policy_id, expense_count: rows.length, xml_count: xmlCount },
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return Response.json(
      {
        ok: true,
        signed_url: signed?.signedUrl ?? null,
        file_name: fileName,
        stats: {
          expenses: rows.length,
          xml: xmlCount,
          pdf: pdfCount,
          tickets: ticketCount,
          size_kb: Math.round(zipBuffer.length / 1024),
        },
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
