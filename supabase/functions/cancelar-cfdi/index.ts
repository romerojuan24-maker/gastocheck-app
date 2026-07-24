// Edge Function: cancelar-cfdi
// Cancela un CFDI ya timbrado ante el PAC (Facturama o FacturAPI), con
// motivo SAT. Body: { request_id: uuid, motivo: '01'|'02'|'03'|'04',
// folio_sustitucion?: string }  (folio_sustitucion solo aplica a motivo '01')
// Auth: requiere JWT del usuario (Authorization: Bearer ...)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const MOTIVOS_VALIDOS = ['01', '02', '03', '04']

async function cancelarFacturama(cfg: any, uuid: string, motivo: string, folioSustitucion?: string) {
  const base = cfg.mode === 'production' ? 'https://api.facturama.mx' : 'https://apisandbox.facturama.mx'
  const auth = btoa(`${cfg.pac_user_enc ?? ''}:${cfg.pac_pass_enc ?? ''}`)
  const params = new URLSearchParams({ motive: motivo })
  if (motivo === '01' && folioSustitucion) params.set('uuidReplacement', folioSustitucion)

  const resp = await fetch(`${base}/cfdi/${uuid}?${params}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${auth}` },
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(`Facturama ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`)
  return data
}

async function cancelarFacturapia(cfg: any, uuid: string, motivo: string, folioSustitucion?: string) {
  const base = 'https://www.facturapi.io/v2'
  const key = cfg.pac_pass_enc ?? ''
  const body: Record<string, unknown> = { motive: motivo }
  if (motivo === '01' && folioSustitucion) body.substitution = folioSustitucion

  const resp = await fetch(`${base}/invoices/${uuid}/cancel`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(`FacturAPI ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`)
  return data
}

const ADAPTERS: Record<string, (cfg: any, uuid: string, motivo: string, folio?: string) => Promise<any>> = {
  facturama: cancelarFacturama,
  facturapia: cancelarFacturapia,
  facturapi: cancelarFacturapia,
}

Deno.serve(async (httpReq) => {
  if (httpReq.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (httpReq.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const authHeader = httpReq.headers.get('Authorization') ?? ''
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')) ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser()
    if (authErr || !caller) return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS })

    const { request_id, motivo, folio_sustitucion } = await httpReq.json()
    if (!request_id) return Response.json({ error: 'request_id requerido' }, { status: 400, headers: CORS })
    if (!MOTIVOS_VALIDOS.includes(motivo)) return Response.json({ error: 'Motivo SAT inválido (01-04)' }, { status: 400, headers: CORS })
    if (motivo === '01' && !folio_sustitucion) return Response.json({ error: 'Motivo 01 requiere el UUID del comprobante que sustituye' }, { status: 400, headers: CORS })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!)

    const { data: req, error: e1 } = await admin.from('cfdi_issue_requests').select('*').eq('id', request_id).single()
    if (e1 || !req) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404, headers: CORS })
    if (req.status !== 'timbrado') return Response.json({ error: `No se puede cancelar: estado actual "${req.status}"` }, { status: 409, headers: CORS })

    const { data: member } = await admin
      .from('company_members')
      .select('role')
      .eq('company_id', req.company_id)
      .eq('user_id', caller.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member || !['owner', 'admin', 'accountant', 'supervisor', 'contador_general'].includes(member.role)) {
      return Response.json({ error: 'Sin permisos para cancelar en esta empresa' }, { status: 403, headers: CORS })
    }

    const { data: cfg } = await admin
      .from('cfdi_provider_configs')
      .select('*')
      .eq('company_id', req.company_id)
      .eq('is_active', true)
      .maybeSingle()
    if (!cfg) return Response.json({ error: 'No hay proveedor PAC activo' }, { status: 412, headers: CORS })

    const adapter = ADAPTERS[(cfg.provider || '').toLowerCase()]
    if (!adapter) return Response.json({ error: `Proveedor no soportado: ${cfg.provider}` }, { status: 400, headers: CORS })

    const ENC_KEY = Deno.env.get('CFDI_ENC_KEY') ?? ''
    const { data: pacUser } = await admin.rpc('pgp_decrypt_secret', { enc: cfg.pac_user_enc, enc_key: ENC_KEY })
    const { data: pacPass } = await admin.rpc('pgp_decrypt_secret', { enc: cfg.pac_pass_enc, enc_key: ENC_KEY })
    const cfgDecrypted = { ...cfg, pac_user_enc: pacUser, pac_pass_enc: pacPass }

    try {
      await adapter(cfgDecrypted, req.uuid_cfdi, motivo, folio_sustitucion)
      await admin.from('cfdi_issue_requests').update({ status: 'cancelled' }).eq('id', request_id)
      // El CFDI cancelado también puede existir como cfdi_documents (direction=issued) — reflejar ahí también.
      await admin.from('cfdi_documents').update({ status: 'cancelado' }).eq('company_id', req.company_id).eq('uuid_cfdi', req.uuid_cfdi)
      await admin.from('audit_logs').insert({
        company_id: req.company_id, user_id: caller.id,
        entity_type: 'cfdi_issue_request', entity_id: request_id,
        action: 'cfdi_cancelado',
        new_values: { uuid_cfdi: req.uuid_cfdi, motivo, folio_sustitucion: folio_sustitucion ?? null },
      })
      return Response.json({ ok: true }, { headers: CORS })
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 502, headers: CORS })
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500, headers: CORS })
  }
})
