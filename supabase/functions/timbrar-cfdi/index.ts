// Edge Function: timbrar-cfdi
// Timbrado CFDI 4.0 multi-proveedor (NO único): Facturama y FacturaPía.
// Lee credenciales de cfdi_provider_configs, timbra una cfdi_issue_requests.
// Deploy: supabase functions deploy timbrar-cfdi
//
// Body: { request_id: uuid }  (la solicitud debe existir en cfdi_issue_requests)
// Auth: requiere JWT del usuario (Authorization: Bearer ...)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

interface IssueRequest {
  id: string
  company_id: string
  cfdi_type: string
  receptor_rfc: string
  receptor_razon_social: string | null
  receptor_uso_cfdi: string
  receptor_codigo_postal: string | null
  receptor_regimen: string | null
  items: any[]
  subtotal: number | null
  iva: number | null
  total: number | null
  metodo_pago: string | null
  forma_pago: string | null
  provider: string
  status: string
  related_uuid_cfdi: string | null
  relacion_tipo: string | null
}

interface ProviderConfig {
  provider: string
  rfc: string
  razon_social: string | null
  regimen_fiscal: string | null
  codigo_postal_fiscal: string | null
  pac_user_enc: string | null
  pac_pass_enc: string | null
  mode: string
  is_active: boolean
}

interface TimbreResult {
  uuid: string
  xml: string | null
  pdf_url: string | null
  provider_id: string | null
}

// ---------------------------------------------------------------------------
// ADAPTADOR: Facturama  (https://facturama.mx — apisandbox/api)
// ---------------------------------------------------------------------------
async function timbrarFacturama(cfg: ProviderConfig, req: IssueRequest): Promise<TimbreResult> {
  const base = cfg.mode === 'production' ? 'https://api.facturama.mx' : 'https://apisandbox.facturama.mx'
  const auth = btoa(`${cfg.pac_user_enc ?? ''}:${cfg.pac_pass_enc ?? ''}`)

  const payload = {
    Serie: 'A',
    Currency: 'MXN',
    ExpeditionPlace: cfg.codigo_postal_fiscal ?? '00000',
    CfdiType: req.cfdi_type === 'egreso' ? 'E' : 'I',
    PaymentForm: req.forma_pago ?? '03',
    PaymentMethod: req.metodo_pago ?? 'PUE',
    Receiver: {
      Rfc: req.receptor_rfc,
      Name: req.receptor_razon_social ?? 'PUBLICO EN GENERAL',
      CfdiUse: req.receptor_uso_cfdi ?? 'G03',
      FiscalRegime: req.receptor_regimen ?? '601',
      TaxZipCode: req.receptor_codigo_postal ?? cfg.codigo_postal_fiscal ?? '00000',
    },
    Items: (req.items ?? []).map((it: any) => {
      const qty = Number(it.cantidad ?? it.quantity ?? 1)
      const unitPrice = Number(it.valor_unitario ?? it.precio ?? it.unit_price ?? 0)
      const importe = Number(it.importe ?? qty * unitPrice)
      const desc = Number(it.descuento ?? 0)
      const base = Math.max(0, importe - desc)
      const iva = Number(it.iva_trasladado ?? it.iva ?? +(base * 0.16).toFixed(2))
      const retIsr = Number(it.ret_isr ?? 0)
      const retIva = Number(it.ret_iva ?? 0)
      const taxes: any[] = [{ Total: iva, Name: 'IVA', Base: base, Rate: 0.16, IsRetention: false }]
      if (retIva > 0) taxes.push({ Total: retIva, Name: 'IVA', Base: base, Rate: 0.106667, IsRetention: true })
      if (retIsr > 0) taxes.push({ Total: retIsr, Name: 'ISR', Base: base, Rate: 0.10, IsRetention: true })
      return {
        ProductCode: it.clave_prod ?? '01010101',
        UnitCode: it.clave_unidad ?? 'H87',
        Description: it.descripcion ?? it.description ?? 'Concepto',
        Quantity: qty,
        UnitPrice: unitPrice,
        Subtotal: importe,
        ...(desc > 0 ? { Discount: desc } : {}),
        TaxObject: '02',
        Taxes: taxes,
        Total: +(base + iva - retIsr - retIva).toFixed(2),
      }
    }),
    ...(req.related_uuid_cfdi ? {
      CfdiRelatedDocuments: [{ Uuid: req.related_uuid_cfdi, RelationshipType: req.relacion_tipo ?? '01' }],
    } : {}),
  }

  const resp = await fetch(`${base}/3/cfdis`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`Facturama ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`)
  return { uuid: data.Complement?.TaxStamp?.Uuid ?? data.Id, xml: null, pdf_url: null, provider_id: data.Id ?? null }
}

// ---------------------------------------------------------------------------
// ADAPTADOR: FacturaPía  (https://facturapi.io style / facturapia)
// ---------------------------------------------------------------------------
async function timbrarFacturapia(cfg: ProviderConfig, req: IssueRequest): Promise<TimbreResult> {
  const base = cfg.mode === 'production' ? 'https://www.facturapi.io/v2' : 'https://www.facturapi.io/v2'
  const key = cfg.pac_pass_enc ?? '' // FacturAPI usa API key (secret) como Bearer

  const payload = {
    type: req.cfdi_type === 'egreso' ? 'E' : 'I',
    customer: {
      legal_name: req.receptor_razon_social ?? 'PUBLICO EN GENERAL',
      tax_id: req.receptor_rfc,
      tax_system: req.receptor_regimen ?? '601',
      address: { zip: req.receptor_codigo_postal ?? cfg.codigo_postal_fiscal ?? '00000' },
    },
    use: req.receptor_uso_cfdi ?? 'G03',
    items: (req.items ?? []).map((it: any) => ({
      quantity: Number(it.cantidad ?? it.quantity ?? 1),
      discount: Number(it.descuento ?? 0) || undefined,
      product: {
        description: it.descripcion ?? it.description ?? 'Concepto',
        product_key: it.clave_prod ?? '01010101',
        unit_key: it.clave_unidad ?? 'H87',
        price: Number(it.valor_unitario ?? it.precio ?? it.unit_price ?? 0),
      },
    })),
    payment_method: req.metodo_pago ?? 'PUE',
    payment_form: req.forma_pago ?? '03',
    ...(req.related_uuid_cfdi ? {
      related_documents: [{ uuid: req.related_uuid_cfdi, relationship: req.relacion_tipo ?? '01' }],
    } : {}),
  }

  const resp = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`FacturAPI ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`)
  return { uuid: data.uuid ?? data.id, xml: null, pdf_url: null, provider_id: data.id ?? null }
}

const ADAPTERS: Record<string, (cfg: ProviderConfig, req: IssueRequest) => Promise<TimbreResult>> = {
  facturama: timbrarFacturama,
  facturapia: timbrarFacturapia,
  facturapi: timbrarFacturapia,
}

Deno.serve(async (httpReq) => {
  if (httpReq.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (httpReq.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const authHeader = httpReq.headers.get('Authorization') ?? ''
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authErr } = await supabaseUser.auth.getUser()
    if (authErr || !caller) return Response.json({ error: 'No autenticado' }, { status: 401, headers: CORS })

    const { request_id } = await httpReq.json()
    if (!request_id) return Response.json({ error: 'request_id requerido' }, { status: 400, headers: CORS })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: req, error: e1 } = await admin.from('cfdi_issue_requests').select('*').eq('id', request_id).single()
    if (e1 || !req) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404, headers: CORS })
    if (req.status === 'timbrado') return Response.json({ error: 'Ya está timbrada', uuid: req.uuid_cfdi }, { status: 409, headers: CORS })

    const { data: member } = await admin
      .from('company_members')
      .select('role')
      .eq('company_id', req.company_id)
      .eq('user_id', caller.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member || !['owner', 'admin', 'accountant', 'supervisor', 'contador_general'].includes(member.role)) {
      return Response.json({ error: 'Sin permisos para timbrar en esta empresa' }, { status: 403, headers: CORS })
    }

    const { data: cfg } = await admin
      .from('cfdi_provider_configs')
      .select('*')
      .eq('company_id', req.company_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!cfg) {
      await admin.from('cfdi_issue_requests').update({ status: 'error', error_message: 'No hay proveedor PAC activo configurado' }).eq('id', request_id)
      return Response.json({ error: 'No hay proveedor PAC activo. Configura Facturama o FacturAPI en Ajustes.' }, { status: 412, headers: CORS })
    }

    const adapter = ADAPTERS[(cfg.provider || '').toLowerCase()]
    if (!adapter) return Response.json({ error: `Proveedor no soportado: ${cfg.provider}` }, { status: 400, headers: CORS })

    // pac_user_enc/pac_pass_enc están cifrados en la base de datos (pgcrypto).
    // La llave solo vive en este secreto de entorno — nunca en la BD ni en el cliente.
    const ENC_KEY = Deno.env.get('CFDI_ENC_KEY') ?? ''
    const { data: pacUser } = await admin.rpc('pgp_decrypt_secret', { enc: cfg.pac_user_enc, enc_key: ENC_KEY })
    const { data: pacPass } = await admin.rpc('pgp_decrypt_secret', { enc: cfg.pac_pass_enc, enc_key: ENC_KEY })
    const cfgDecrypted = { ...cfg, pac_user_enc: pacUser, pac_pass_enc: pacPass }

    try {
      const result = await adapter(cfgDecrypted as ProviderConfig, req as IssueRequest)
      await admin.from('cfdi_issue_requests').update({
        status: 'timbrado', uuid_cfdi: result.uuid, provider: cfg.provider,
        provider_id: result.provider_id, pdf_storage_path: result.pdf_url, timbrado_at: new Date().toISOString(),
      }).eq('id', request_id)

      // El "documento" final (lo que se ve en CFDIs > Emitidas) vive en
      // cfdi_documents — timbrar solo actualizaba cfdi_issue_requests, así
      // que un CFDI recién timbrado nunca aparecía en la lista.
      const r = req as IssueRequest
      await admin.from('cfdi_documents').insert({
        company_id: req.company_id, direction: 'issued', uuid_cfdi: result.uuid,
        rfc_emisor: cfg.rfc, razon_social_emisor: cfg.razon_social,
        rfc_receptor: r.receptor_rfc, razon_social_receptor: r.receptor_razon_social,
        fecha_emision: new Date().toISOString(), subtotal: r.subtotal, iva: r.iva, total: r.total,
        forma_pago: '03', metodo_pago: 'PUE', uso_cfdi: r.receptor_uso_cfdi,
        tipo_comprobante: r.cfdi_type === 'egreso' ? 'E' : 'I',
        status: 'vigente', pdf_storage_path: result.pdf_url,
      })

      await admin.from('audit_logs').insert({
        company_id: req.company_id, user_id: caller.id,
        entity_type: 'cfdi_issue_request', entity_id: request_id,
        action: 'cfdi_timbrado',
        new_values: { uuid_cfdi: result.uuid, provider: cfg.provider, receptor_rfc: (req as any).receptor_rfc, total: (req as any).total },
      })
      return Response.json({ ok: true, uuid: result.uuid, provider: cfg.provider }, { headers: CORS })
    } catch (err) {
      await admin.from('cfdi_issue_requests').update({ status: 'error', error_message: String(err) }).eq('id', request_id)
      return Response.json({ error: String(err) }, { status: 502, headers: CORS })
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500, headers: CORS })
  }
})
