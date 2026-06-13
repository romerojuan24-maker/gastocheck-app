// Edge Function: Verifica un CFDI UUID en el SAT (webservice SOAP oficial)
// Input:  { uuid, rfc_emisor, rfc_receptor, total, company_id, receipt_id? }
// Output: { ok, estado, cancelable, codigo_estatus, efos_status, sat_response }
// Deploy: npx supabase functions deploy validate-cfdi

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SAT_SOAP_URL =
  'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface ValidateInput {
  uuid:          string;
  rfc_emisor?:   string | null;
  rfc_receptor?: string | null;
  total?:        number | null;
  company_id?:   string;
  receipt_id?:   string;
}

interface SatResult {
  estado:           'Vigente' | 'Cancelado' | 'No Encontrado' | 'Error';
  cancelable?:      string;
  codigo_estatus?:  string;
  efos_status?:     string;
  raw_response?:    string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 });

  try {
    const input: ValidateInput = await req.json();

    if (!input.uuid) {
      return Response.json({ error: 'uuid es requerido' }, { status: 400, headers: CORS });
    }

    const uuid  = input.uuid.trim().toUpperCase();
    const re    = (input.rfc_emisor   ?? '').toUpperCase();
    const rr    = (input.rfc_receptor ?? '').toUpperCase();
    const tt    = input.total != null
      ? String(input.total.toFixed(6))  // SAT requiere 6 decimales
      : '0.000000';

    // ── Llamada SOAP al SAT ──────────────────────────────────────────────────
    const expresion = `?re=${re}&rr=${rr}&tt=${tt}&id=${uuid}`;

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
  <soap:Body>
    <tns:Consulta>
      <tns:expresionImpresa><![CDATA[${expresion}]]></tns:expresionImpresa>
    </tns:Consulta>
  </soap:Body>
</soap:Envelope>`;

    let satResult: SatResult = { estado: 'Error' };

    try {
      const satRes = await fetch(SAT_SOAP_URL, {
        method:  'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction':   'http://tempuri.org/IConsultaCFDIService/Consulta',
        },
        body:    soapBody,
        signal:  AbortSignal.timeout(10000),  // 10 s timeout
      });

      const xml = await satRes.text();
      satResult.raw_response = xml;

      // Parsear respuesta SOAP con regex (sin xml parser externo)
      const estado     = extractTag(xml, 'Estado');
      const cancelable = extractTag(xml, 'EsCancelable');
      const codigo     = extractTag(xml, 'CodigoEstatus');
      const efos       = extractTag(xml, 'ValidacionEFOS');

      if (estado === 'Vigente' || estado === 'Cancelado') {
        satResult = {
          estado:          estado as SatResult['estado'],
          cancelable:      cancelable ?? undefined,
          codigo_estatus:  codigo     ?? undefined,
          efos_status:     efos       ?? undefined,
          raw_response:    xml,
        };
      } else if (codigo?.includes('No Encontrado') || xml.includes('No Encontrado')) {
        satResult = { estado: 'No Encontrado', codigo_estatus: codigo ?? undefined, raw_response: xml };
      } else {
        // Respuesta con código de error o sin Estado reconocible
        satResult = { estado: 'No Encontrado', codigo_estatus: codigo ?? 'Sin respuesta', raw_response: xml };
      }
    } catch (satErr) {
      console.error('SAT SOAP error:', satErr);
      // Si el SAT no responde, marcar como no validado (no bloqueamos el flujo)
      satResult = {
        estado:          'Error',
        codigo_estatus:  `SAT no disponible: ${String(satErr).slice(0, 80)}`,
      };
    }

    // ── Actualizar receipt si se proporcionó receipt_id ──────────────────────
    if (input.receipt_id && input.company_id) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

      const validationStatus =
        satResult.estado === 'Vigente'      ? 'validated'  :
        satResult.estado === 'Cancelado'    ? 'cancelled'  :
        satResult.estado === 'No Encontrado'? 'not_found'  :
        'error';

      await supabase.from('receipts').update({
        sat_validation_status: validationStatus,
        sat_validation_reason: satResult.codigo_estatus ?? satResult.estado,
        sat_validation_at:     new Date().toISOString(),
      }).eq('id', input.receipt_id);
    }

    return Response.json({
      ok:            satResult.estado === 'Vigente',
      uuid,
      estado:        satResult.estado,
      cancelable:    satResult.cancelable,
      codigo_estatus: satResult.codigo_estatus,
      efos_status:   satResult.efos_status,
      vigente:       satResult.estado === 'Vigente',
      cancelado:     satResult.estado === 'Cancelado',
      no_encontrado: satResult.estado === 'No Encontrado',
    }, { headers: CORS });

  } catch (e) {
    console.error('validate-cfdi error:', e);
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<`, 'i');
  const m  = xml.match(re);
  return m ? m[1].trim() : null;
}
