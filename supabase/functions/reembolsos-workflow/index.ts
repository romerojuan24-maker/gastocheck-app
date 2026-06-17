import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url     = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabaseAdmin = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const supabaseAnon = createClient(url, anonKey)
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { action, reembolso_id, company_id } = await req.json()

    // ── Crear borrador ─────────────────────────────────────────────────────────
    if (action === 'create_draft') {
      const { data: reembolso, error: errCreate } = await supabaseAdmin
        .from('reembolsos')
        .insert([{
          company_id,
          employee_id: user.id,
          employee_email: user.email ?? '',
          status: 'draft',
          total: 0,
          notes: '',
        }])
        .select('id')
        .single()

      if (errCreate) throw errCreate
      return new Response(JSON.stringify({ success: true, reembolso_id: reembolso.id }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // ── Enviar a supervisor ────────────────────────────────────────────────────
    if (action === 'submit') {
      const { data: reembolso } = await supabaseAdmin
        .from('reembolsos')
        .select('id, status, employee_id, company_id')
        .eq('id', reembolso_id)
        .single()

      if (!reembolso) throw new Error('Reembolso no encontrado')
      if (reembolso.employee_id !== user.id) throw new Error('No autorizado')
      if (reembolso.status !== 'draft') throw new Error('Solo se pueden enviar reembolsos en estado DRAFT')

      const { data: receipts } = await supabaseAdmin
        .from('receipt_reembolsos')
        .select('receipt_id')
        .eq('reembolso_id', reembolso_id)

      if (!receipts || receipts.length === 0) {
        throw new Error('El reembolso no tiene comprobantes asignados')
      }

      const receiptIds = receipts.map((r: any) => r.receipt_id)
      const { data: receiptData } = await supabaseAdmin
        .from('receipts')
        .select('total_amount, is_credit')
        .in('id', receiptIds)

      // Comprobantes a crédito no descuentan saldo del comprador
      const total = (receiptData ?? []).reduce((s: number, r: any) => {
        if (r.is_credit) return s
        return s + (r.total_amount ?? 0)
      }, 0)

      const { error: errUpdate } = await supabaseAdmin
        .from('reembolsos')
        .update({ status: 'pending_auth', total })
        .eq('id', reembolso_id)

      if (errUpdate) throw errUpdate

      return new Response(JSON.stringify({ success: true, message: 'Reembolso enviado a supervisor' }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // ── Generar reporte HTML ────────────────────────────────────────────────────
    if (action === 'generate_report') {
      const { data: reembolso } = await supabaseAdmin
        .from('reembolsos')
        .select('id, employee_email, status, total, notes, created_at, company_id')
        .eq('id', reembolso_id)
        .single()

      if (!reembolso) throw new Error('Reembolso no encontrado')

      const { data: rr } = await supabaseAdmin
        .from('receipt_reembolsos')
        .select('receipt_id')
        .eq('reembolso_id', reembolso_id)

      const ids = (rr ?? []).map((r: any) => r.receipt_id)
      const { data: receipts } = ids.length > 0
        ? await supabaseAdmin
            .from('receipts')
            .select('provider_name, receipt_date, total_amount, fiscal_uuid, payment_method, is_credit, sat_validation_status')
            .in('id', ids)
        : { data: [] }

      const fmt = (n: number | null) =>
        n == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

      const rows = (receipts ?? []).map((r: any) => `
        <tr>
          <td>${r.provider_name ?? '—'}</td>
          <td>${r.receipt_date ?? '—'}</td>
          <td style="text-align:right">${fmt(r.total_amount)}</td>
          <td>${r.is_credit ? 'Crédito' : 'Pagado'}</td>
          <td>${r.fiscal_uuid ? r.fiscal_uuid.slice(0, 8) + '…' : '—'}</td>
          <td>${r.sat_validation_status === 'validated' ? '✅' : r.sat_validation_status === 'cancelled' ? '❌' : '—'}</td>
        </tr>`).join('')

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reporte de Reembolso</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #0F172A; }
    h1 { font-size: 22px; color: #1565C0; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #607D8B; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1565C0; color: #fff; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #E0E0E0; }
    tr:nth-child(even) { background: #F5F7FA; }
    .total { font-size: 16px; font-weight: 700; color: #1565C0; text-align: right; margin-top: 16px; }
    .footer { font-size: 11px; color: #90A4AE; margin-top: 32px; }
  </style>
</head>
<body>
  <h1>GastoCheck — Reporte de Reembolso</h1>
  <div class="meta">
    <b>Empleado:</b> ${reembolso.employee_email}<br>
    <b>Fecha solicitud:</b> ${new Date(reembolso.created_at).toLocaleDateString('es-MX')}<br>
    <b>Estado:</b> ${reembolso.status}<br>
    ${reembolso.notes ? `<b>Notas:</b> ${reembolso.notes}<br>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Proveedor</th>
        <th>Fecha</th>
        <th style="text-align:right">Monto</th>
        <th>Tipo</th>
        <th>UUID CFDI</th>
        <th>SAT</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total a reembolsar: ${fmt(reembolso.total)}</div>
  <div class="footer">Generado por GastoCheck · ${new Date().toLocaleString('es-MX')}</div>
</body>
</html>`

      const encoder = new TextEncoder()
      const bytes = encoder.encode(html)
      const path = `${reembolso.company_id}/reembolso_${reembolso_id.slice(0, 8)}.html`

      const { error: upErr } = await supabaseAdmin.storage
        .from('report-exports')
        .upload(path, bytes, { contentType: 'text/html; charset=utf-8', upsert: true })

      if (upErr) throw upErr

      const { data: signed } = await supabaseAdmin.storage
        .from('report-exports')
        .createSignedUrl(path, 3600)

      return new Response(JSON.stringify({ success: true, url: signed?.signedUrl }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
