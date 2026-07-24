// Edge Function: Verifica un CFDI UUID en el SAT (webservice SOAP oficial)
// Input:  { uuid, rfc_emisor, rfc_receptor, total, company_id, receipt_id? }
// Output: { ok, estado, cancelable, codigo_estatus, efos_status, sat_response }
// Deploy: npx supabase functions deploy validate-cfdi

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) ?? '';

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
    // Nota: SAT es sensible al formato RFC (RFC extranjero para DHL, etc.)
    const expresion = `?re=${re}&rr=${rr}&tt=${tt}&id=${uuid}`;

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
  <soap:Body>
    <tns:Consulta>
      <tns:expresionImpresa><![CDATA[${expresion}]]></tns:expresionImpresa>
    </tns:Consulta>
  </soap:Body>
</soap:Envelope>`;

    console.log(`[SAT] Consultando: re=${re.slice(0, 8)}... rr=${rr.slice(0, 8)}... tt=${tt} uuid=${uuid}`);

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

      // Parsear respuesta SOAP con regex robusto (maneja namespaces)
      const estado     = extractTag(xml, 'Estado');
      const cancelable = extractTag(xml, 'EsCancelable');
      const codigo     = extractTag(xml, 'CodigoEstatus');
      const efos       = extractTag(xml, 'ValidacionEFOS');

      console.log(`[SAT] UUID=${uuid} resp Estado=${estado} Codigo=${codigo} EFOS=${efos}`);

      if ((estado === 'Vigente' || estado === 'Cancelado') && estado) {
        satResult = {
          estado:          estado as SatResult['estado'],
          cancelable:      cancelable ?? undefined,
          codigo_estatus:  codigo     ?? undefined,
          efos_status:     efos       ?? undefined,
          raw_response:    xml,
        };
      } else if (codigo?.includes('No Encontrado') || xml.includes('No Encontrado')) {
        satResult = { estado: 'No Encontrado', codigo_estatus: codigo ?? 'RFC/Total/UUID inválido', raw_response: xml };
      } else {
        // Respuesta SOAP sin Estado reconocible — probablemente error de formato
        console.warn(`[SAT] Respuesta inusual para ${uuid}: no se pudo extraer Estado. XML snippet: ${xml.slice(0, 500)}`);
        satResult = { estado: 'No Encontrado', codigo_estatus: codigo ?? 'Error parsing SAT response', raw_response: xml };
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

      const reason = satResult.codigo_estatus ?? satResult.estado ?? 'No especificado';

      console.log(`[SAT] Updating receipt ${input.receipt_id} → status=${validationStatus} reason=${reason}`);

      await supabase.from('receipts').update({
        sat_validation_status: validationStatus,
        sat_validation_reason: reason,
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
  // Busca el tag con namespace opcional: <ns:Tag>, <ns:Tag attr="x">, <Tag>
  // Captura contenido: >([^<]*)<  pero también maneja espacios/saltos de línea
  const patterns = [
    new RegExp(`<[a-zA-Z0-9]*:${tag}[^>]*>\\s*([^<]*)\\s*</`, 'i'),  // con namespace
    new RegExp(`<${tag}[^>]*>\\s*([^<]*)\\s*</`, 'i'),                 // sin namespace
  ];

  for (const re of patterns) {
    const m = xml.match(re);
    if (m && m[1]) {
      const val = m[1].trim();
      if (val) return val;  // Solo retorna si hay contenido real
    }
  }
  return null;
}
