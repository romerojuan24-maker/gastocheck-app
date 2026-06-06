// Edge Function: parsea un XML CFDI y devuelve datos fiscales estructurados.
// Deploy: supabase functions deploy xml-parse
import { parseCfdiXml } from '../../../packages/shared/src/cfdi.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const { xml } = await req.json();
    if (!xml) return Response.json({ error: 'xml requerido' }, { status: 400 });
    const data = parseCfdiXml(xml);
    return Response.json({ ok: true, data });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
